import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Crown,
  Eye,
  FileText,
  FolderKanban,
  LineChart,
  Pencil,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import MetricCard from '../components/common/MetricCard';
import FormField from '../components/common/FormField';
import DemoNotice from '../components/common/DemoNotice';
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import EmptyState from '../components/common/EmptyState';
import DataTable from '../components/common/DataTable';
import Pagination from '../components/common/Pagination';
import StatusBadge from '../components/common/StatusBadge';
import { useApp } from '../context/AppContext';
import { ROLE_OPTIONS } from '../data/teamMembers';
import {
  formatDate,
  formatDateTime,
  getInitials,
  todayIso,
} from '../utils/formatters';

const PAGE_SIZE = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUS_OPTIONS = ['Active', 'Inactive'];
const AVATAR_COLORS = ['#08764F', '#0EA5A4', '#2563EB', '#B45309', '#7C3AED', '#DB2777', '#C2410C'];

const ROLE_CLASSES = {
  'Project Owner': 'owner',
  Analyst: 'analyst',
  Viewer: 'viewer',
};

const ACTIVITY_ICONS = {
  member: UserPlus,
  role: ShieldCheck,
  settings: Settings2,
  analysis: LineChart,
  report: FileText,
};

function defaultMemberForm() {
  return {
    name: '',
    email: '',
    role: 'Viewer',
    status: 'Active',
    joinedOn: todayIso(),
  };
}

function joinedTime(member) {
  const time = new Date(member.joinedOn).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function RoleBadge({ role }) {
  return <span className={`role-badge ${ROLE_CLASSES[role] || 'viewer'}`}>{role}</span>;
}

function nextAvatarColor(members) {
  const used = new Set(members.map((member) => member.avatarColor));
  return (
    AVATAR_COLORS.find((color) => !used.has(color)) ||
    AVATAR_COLORS[members.length % AVATAR_COLORS.length]
  );
}

export default function Team() {
  const {
    teamMembers,
    activities,
    addTeamMember,
    updateTeamMember,
    removeTeamMember,
    showToast,
  } = useApp();

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [memberForm, setMemberForm] = useState(defaultMemberForm);
  const [formErrors, setFormErrors] = useState({});
  const [removeTarget, setRemoveTarget] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [query, roleFilter]);

  const orderedMembers = useMemo(
    () =>
      [...teamMembers].sort((a, b) => {
        const ownerRank = (member) => (member.role === 'Project Owner' ? 0 : 1);
        const byRole = ownerRank(a) - ownerRank(b);
        if (byRole !== 0) return byRole;
        const byDate = joinedTime(b) - joinedTime(a);
        if (byDate !== 0) return byDate;
        return a.name.localeCompare(b.name);
      }),
    [teamMembers],
  );

  const filteredMembers = useMemo(() => {
    const search = query.trim().toLowerCase();
    return orderedMembers.filter((member) => {
      if (roleFilter !== 'all' && member.role !== roleFilter) return false;
      if (!search) return true;
      return `${member.name} ${member.email}`.toLowerCase().includes(search);
    });
  }, [orderedMembers, query, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedMembers = filteredMembers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const ownerCount = teamMembers.filter((member) => member.role === 'Project Owner').length;
  const analystCount = teamMembers.filter((member) => member.role === 'Analyst').length;
  const viewerCount = teamMembers.filter((member) => member.role === 'Viewer').length;

  const sortedActivities = useMemo(
    () =>
      [...activities].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [activities],
  );
  const recentActivities = sortedActivities.slice(0, 6);
  const latestActivity = sortedActivities[0] || null;

  const openAddModal = () => {
    setEditingId(null);
    setMemberForm(defaultMemberForm());
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditModal = (member) => {
    setEditingId(member.id);
    setMemberForm({
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status,
      joinedOn: member.joinedOn,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const closeMemberModal = () => {
    setFormOpen(false);
    setEditingId(null);
    setFormErrors({});
  };

  const updateField = (key, value) => {
    setMemberForm((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleMemberSubmit = (event) => {
    event.preventDefault();

    const values = {
      name: memberForm.name.trim(),
      email: memberForm.email.trim(),
      role: memberForm.role,
      status: memberForm.status,
      joinedOn: memberForm.joinedOn,
    };

    const nextErrors = {};
    if (values.name.length < 2) {
      nextErrors.name = 'Enter at least two characters.';
    }
    if (!values.email) {
      nextErrors.email = 'Enter a demo email address.';
    } else if (!EMAIL_PATTERN.test(values.email)) {
      nextErrors.email = 'Enter a valid email address.';
    } else if (
      teamMembers.some(
        (member) =>
          member.email.toLowerCase() === values.email.toLowerCase() && member.id !== editingId,
      )
    ) {
      nextErrors.email = 'A demo member with this email already exists.';
    }
    if (!ROLE_OPTIONS.includes(values.role)) {
      nextErrors.role = 'Select a valid role.';
    }
    if (!STATUS_OPTIONS.includes(values.status)) {
      nextErrors.status = 'Select a valid status.';
    }
    if (!values.joinedOn) {
      nextErrors.joinedOn = 'Select a join date.';
    } else if (values.joinedOn > todayIso()) {
      nextErrors.joinedOn = 'Join date cannot be in the future.';
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (editingId) {
      const original = teamMembers.find((member) => member.id === editingId);
      if (!original) {
        closeMemberModal();
        return;
      }

      let activityText = `${values.name}'s demo member details were updated`;
      if (original.role !== values.role) {
        activityText = `${values.name}'s role was changed from ${original.role} to ${values.role}`;
      } else if (original.status !== values.status) {
        activityText = `${values.name}'s status was changed from ${original.status} to ${values.status}`;
      }

      updateTeamMember({ ...original, ...values }, activityText);
      showToast({
        type: 'success',
        title: 'Demo member updated',
        message: `${values.name}'s details were saved in this browser only. No real access or account was changed.`,
      });
    } else {
      const newMember = {
        id: `member-${Date.now()}`,
        ...values,
        avatarColor: nextAvatarColor(teamMembers),
        isDemo: true,
      };
      addTeamMember(newMember);
      setQuery('');
      setRoleFilter('all');
      setPage(1);
      showToast({
        type: 'success',
        title: 'Demo member added',
        message: `${values.name} was added to the local demo team. No invitation email was sent and no remote account was created.`,
      });
    }

    closeMemberModal();
  };

  const handleRemoveMember = () => {
    if (!removeTarget) return;
    removeTeamMember(removeTarget.id, removeTarget.name);
    showToast({
      type: 'success',
      title: 'Demo member removed',
      message: `${removeTarget.name} was removed from this browser's fictional team directory. No real account was affected.`,
    });
    setRemoveTarget(null);
  };

  const columns = [
    {
      key: 'avatar',
      label: 'Avatar',
      width: 52,
      render: (member) => (
        <span
          className="member-avatar"
          style={{ background: member.avatarColor || '#08764F' }}
          aria-hidden="true"
        >
          {getInitials(member.name)}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      render: (member) => <span className="cell-strong">{member.name}</span>,
    },
    {
      key: 'email',
      label: 'Email',
      render: (member) => <span className="cell-muted">{member.email}</span>,
    },
    {
      key: 'role',
      label: 'Role',
      render: (member) => <RoleBadge role={member.role} />,
    },
    {
      key: 'joinedOn',
      label: 'Joined On',
      render: (member) => formatDate(member.joinedOn),
    },
    {
      key: 'status',
      label: 'Status',
      render: (member) => <StatusBadge value={member.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      className: 'cell-actions',
      render: (member) => (
        <div className="btn-group" style={{ justifyContent: 'flex-end', gap: 4 }}>
          <button
            type="button"
            className="icon-btn plain"
            onClick={() => openEditModal(member)}
            aria-label={`Edit ${member.name}`}
            title="Edit member, role or status"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="icon-btn plain"
            onClick={() => setRemoveTarget(member)}
            aria-label={`Remove ${member.name}`}
            title="Remove demo member"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Project Team"
        subtitle="Manage team members, roles and project collaborations."
        meta={
          <>
            <span className="badge badge-info">
              <span className="dot" aria-hidden="true" />
              Fictional demo team
            </span>
            <span className="chip neutral">No invitations are sent</span>
          </>
        }
        actions={
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            <UserPlus size={14} aria-hidden="true" />
            Add New Member
          </button>
        }
      />

      <div className="metrics-grid">
        <MetricCard
          icon={Users}
          label="Total Members"
          value={teamMembers.length}
          help="All fictional members in the directory"
          tone="teal"
        />
        <MetricCard
          icon={Crown}
          label="Project Owners"
          value={ownerCount}
          help="Owner-level demo role"
          tone="amber"
        />
        <MetricCard
          icon={LineChart}
          label="Analysts"
          value={analystCount}
          help="Analysis-focused demo role"
          tone="blue"
        />
        <MetricCard
          icon={Eye}
          label="Viewers"
          value={viewerCount}
          help="Read-only demo role"
        />
      </div>

      <div className="team-layout">
        <section className="card" aria-labelledby="team-members-title">
          <div className="card-head">
            <div>
              <h2 className="card-title" id="team-members-title">
                <Users size={16} aria-hidden="true" />
                Team Members
              </h2>
              <p className="card-subtitle">
                Search and filter the demonstration directory
              </p>
            </div>
            <span className="chip">Demo records</span>
          </div>

          <div className="table-toolbar">
            <div className="table-toolbar-left">
              <div className="search-input">
                <Search size={14} aria-hidden="true" />
                <input
                  type="search"
                  className="input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name or email"
                  aria-label="Search team members by name or email"
                />
              </div>
              <select
                className="select"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                aria-label="Filter members by role"
                style={{ width: 152 }}
              >
                <option value="all">All roles</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div className="table-toolbar-right">
              <span className="table-count">
                {filteredMembers.length} of {teamMembers.length} demo members
              </span>
            </div>
          </div>

          <DataTable
            columns={columns}
            rows={pagedMembers}
            emptyTitle="No members match this view"
            emptyMessage="Try another name or role, or add a new fictional demo member."
            emptyIcon={Users}
            className="team-table"
            caption="Fictional project team members"
          />

          <Pagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={filteredMembers.length}
            onChange={setPage}
            itemLabel="members"
          />

          <div className="card-foot">
            <DemoNotice>
              All people and email addresses in this directory are fictional demonstration records.
              Adding or editing a member changes this browser only; no invitation, account or
              permission is created or modified.
            </DemoNotice>
          </div>
        </section>

        <aside className="team-side">
          <section className="card" aria-labelledby="project-overview-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="project-overview-title">
                  <FolderKanban size={16} aria-hidden="true" />
                  Project Overview
                </h2>
                <p className="card-subtitle">Demonstration workspace details</p>
              </div>
              <span className="chip">Demo</span>
            </div>
            <div className="card-body">
              <div className="project-overview-block">
                <div className="project-title-row">
                  <span className="project-mark">
                    <img src="/assets/logo.svg" alt="" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="project-name">VanaDrishti AI</div>
                    <div className="member-mail">Forest Loss Monitoring &amp; Early Warning</div>
                  </div>
                </div>
                <p className="project-desc">
                  A fictional conservation workspace demonstrating how optical Sentinel-2 Level-2A
                  imagery could support forest-loss screening and early warning. All team records,
                  maps and findings shown in this build are illustrative.
                </p>
                <div className="project-meta-grid">
                  <div>
                    <div className="k">Project status</div>
                    <div className="v">
                      <StatusBadge value="Active" />
                    </div>
                  </div>
                  <div>
                    <div className="k">Team size</div>
                    <div className="v">
                      {teamMembers.length} member{teamMembers.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div>
                    <div className="k">Last updated</div>
                    <div className="v">
                      {latestActivity ? formatDate(latestActivity.timestamp) : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="k">Intended imagery</div>
                    <div className="v">Sentinel-2 optical</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="recent-activity-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="recent-activity-title">
                  <Activity size={16} aria-hidden="true" />
                  Recent Activity
                </h2>
                <p className="card-subtitle">Newest first · stored in this browser</p>
              </div>
              <span className="chip">Demo</span>
            </div>
            <div className="card-body">
              {recentActivities.length > 0 ? (
                <div className="activity-list">
                  {recentActivities.map((activity) => {
                    const Icon = ACTIVITY_ICONS[activity.type] || Activity;
                    return (
                      <div className="activity-item" key={activity.id}>
                        <span className="activity-icon" aria-hidden="true">
                          <Icon size={13} />
                        </span>
                        <div className="activity-copy">
                          <div className="activity-text">
                            <strong>{activity.actor}</strong> · {activity.text}
                          </div>
                          <div className="activity-time">
                            {formatDateTime(activity.timestamp)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={Activity}
                  title="No activity yet"
                  message="Add a demo member, change a role or generate a report to start the timeline."
                />
              )}
              <div style={{ marginTop: 10 }}>
                <DemoNotice>
                  Activity entries are fictional and stored locally. They do not represent real
                  permissions, invitations or account events.
                </DemoNotice>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <Modal
        open={formOpen}
        onClose={closeMemberModal}
        title={editingId ? 'Edit Team Member' : 'Add New Member'}
        subtitle="Fictional demo records stored in this browser"
        size="wide"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={closeMemberModal}>
              Cancel
            </button>
            <button type="submit" form="member-form" className="btn btn-primary">
              {editingId ? (
                <Save size={14} aria-hidden="true" />
              ) : (
                <UserPlus size={14} aria-hidden="true" />
              )}
              {editingId ? 'Save changes' : 'Add member'}
            </button>
          </>
        }
      >
        <form id="member-form" onSubmit={handleMemberSubmit}>
          <div className="form-grid">
            <FormField label="Full Name" htmlFor="member-name" required error={formErrors.name}>
              <input
                id="member-name"
                type="text"
                className="input"
                value={memberForm.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="e.g. Meera Joshi"
                autoComplete="off"
              />
            </FormField>
            <FormField
              label="Email Address"
              htmlFor="member-email"
              required
              error={formErrors.email}
              hint={formErrors.email ? undefined : 'Use a fictional address; no email will be sent.'}
            >
              <input
                id="member-email"
                type="email"
                className="input"
                value={memberForm.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="analyst@vanadrishti.demo"
                autoComplete="off"
              />
            </FormField>
          </div>

          <div className="form-grid three" style={{ marginTop: 12 }}>
            <FormField label="Role" htmlFor="member-role" required error={formErrors.role}>
              <select
                id="member-role"
                className="select"
                value={memberForm.role}
                onChange={(event) => updateField('role', event.target.value)}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Status" htmlFor="member-status" required error={formErrors.status}>
              <select
                id="member-status"
                className="select"
                value={memberForm.status}
                onChange={(event) => updateField('status', event.target.value)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Joined On"
              htmlFor="member-joined"
              required
              error={formErrors.joinedOn}
            >
              <input
                id="member-joined"
                type="date"
                className="input"
                value={memberForm.joinedOn}
                max={todayIso()}
                onChange={(event) => updateField('joinedOn', event.target.value)}
              />
            </FormField>
          </div>

          <div style={{ marginTop: 14 }}>
            <DemoNotice>
              {editingId
                ? 'Changes affect only this browser’s fictional directory. No real role, permission or account is modified.'
                : 'Adding a member creates a local demo record only. No invitation email is sent and no remote account or permission is created.'}
            </DemoNotice>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        open={Boolean(removeTarget)}
        title="Remove this demo member?"
        message={
          removeTarget
            ? `Remove ${removeTarget.name} (${removeTarget.email}) from this browser's fictional team directory? This cannot be undone.`
            : ''
        }
        confirmLabel="Remove member"
        onConfirm={handleRemoveMember}
        onClose={() => setRemoveTarget(null)}
      >
        <div style={{ marginTop: 10 }}>
          <DemoNotice>
            These team records are illustrative. Removing a member does not delete any real account,
            revoke real access or send any notification.
          </DemoNotice>
        </div>
      </ConfirmationModal>

      <div style={{ marginTop: 16 }}>
        <DemoNotice>
          Project team data is fictional and maintained in localStorage for this frontend
          demonstration. Collaboration, invitations and account permissions require backend
          authentication and an email service.
        </DemoNotice>
      </div>
    </>
  );
}
