import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-6 p-8">
        <div className="space-y-2">
          <h1 className="text-8xl font-bold text-primary">404</h1>
          <p className="text-xl text-foreground font-medium">Page not found</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 pt-4">
          <Link
            to="/dashboard"
            className="px-6 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            to="/"
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
