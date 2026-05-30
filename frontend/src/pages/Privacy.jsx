import { Link } from 'react-router-dom';
import './pageLayout.css';
import './Legal.css';

export default function Privacy() {
  return (
    <div className="legal-page stack fade-up">
      <header className="page-header">
        <p className="eyebrow">Legal</p>
        <h1 className="page-title">FightForge Privacy Policy</h1>
        <p className="muted">Last Updated: May 2026</p>
      </header>

      <div className="legal-body stack">
        <p>
          FightForge (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) provides training, coaching,
          community, and content services for combat sports athletes and coaches.
        </p>

        <section className="stack-tight">
          <h2 className="section-title">Information We Collect</h2>
          <p>We may collect:</p>
          <ul>
            <li>Account information such as name, email address, and profile information.</li>
            <li>Training data including workouts, goals, weight, and performance metrics.</li>
            <li>User-generated content such as posts, videos, messages, and comments.</li>
            <li>Device and usage information necessary to operate and improve the application.</li>
          </ul>
        </section>

        <section className="stack-tight">
          <h2 className="section-title">How We Use Information</h2>
          <p>We use collected information to:</p>
          <ul>
            <li>Provide and improve FightForge services.</li>
            <li>Create personalized training recommendations.</li>
            <li>Enable communication between athletes and coaches.</li>
            <li>Maintain account security.</li>
            <li>Analyze application performance and usage.</li>
          </ul>
        </section>

        <section className="stack-tight">
          <h2 className="section-title">Content Sharing</h2>
          <p>
            Information that users choose to post publicly may be visible to other users of the
            platform.
          </p>
        </section>

        <section className="stack-tight">
          <h2 className="section-title">Data Security</h2>
          <p>
            We take reasonable measures to protect user information. However, no method of electronic
            storage or transmission is completely secure.
          </p>
        </section>

        <section className="stack-tight">
          <h2 className="section-title">Third-Party Services</h2>
          <p>
            FightForge may use third-party services for authentication, analytics, cloud storage,
            video hosting, and application functionality.
          </p>
        </section>

        <section className="stack-tight">
          <h2 className="section-title">Children&apos;s Privacy</h2>
          <p>FightForge is not intended for children under 13 years of age.</p>
        </section>

        <section className="stack-tight">
          <h2 className="section-title">Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your account information by
            contacting us.
          </p>
        </section>

        <section className="stack-tight">
          <h2 className="section-title">Contact</h2>
          <p>
            Craig Omozeje
            <br />
            Email: <a href="mailto:craigomozeje@gmail.com">craigomozeje@gmail.com</a>
          </p>
        </section>

        <section className="stack-tight">
          <h2 className="section-title">Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically. Continued use of FightForge after updates
            constitutes acceptance of the revised policy.
          </p>
        </section>
      </div>

      <div className="cluster">
        <Link to="/support" className="btn-link">
          Contact support
        </Link>
        <Link to="/" className="btn-link">
          Back to FightForge
        </Link>
      </div>
    </div>
  );
}
