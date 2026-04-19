import { Component } from 'react';
import { ErrorPage } from '../pages/ErrorPage';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage
          title="Something went wrong"
          message="An unexpected error occurred while rendering this page."
          showReload
        />
      );
    }

    return this.props.children;
  }
}
