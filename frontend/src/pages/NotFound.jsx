import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Compass, Home } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Page Not Found"
        subtitle="The requested page is not part of this demonstration workspace."
      />
      <section className="card">
        <div className="card-body" style={{ padding: '40px 24px' }}>
          <EmptyState
            icon={Compass}
            title="404 — This page does not exist"
            message="Check the address, or use the navigation to return to one of the seven workspace pages."
            action={
              <div className="form-actions" style={{ justifyContent: 'center', marginTop: 14 }}>
                <Link to="/dashboard" className="btn btn-primary">
                  <Home size={14} aria-hidden="true" />
                  Back to Dashboard
                </Link>
                <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
                  <ArrowLeft size={14} aria-hidden="true" />
                  Go back
                </button>
              </div>
            }
          />
        </div>
      </section>
    </>
  );
}
