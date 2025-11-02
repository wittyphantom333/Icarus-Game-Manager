'use client';

import { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import * as yaml from 'js-yaml';

export default function ApiDocumentation() {
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSpec = async () => {
      try {
        const response = await fetch('/api/docs');
        if (!response.ok) {
          throw new Error('Failed to fetch API specification');
        }
        
        const yamlText = await response.text();
        const parsedSpec = yaml.load(yamlText);
        setSpec(parsedSpec);
      } catch (err) {
        console.error('Error loading API spec:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadSpec();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading API documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Error Loading Documentation</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <a 
            href="/api/docs" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            View Raw OpenAPI Specification
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Icarus Game Manager API Documentation
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Interactive API documentation for the Icarus Game Manager. 
            Explore endpoints, test requests, and view response schemas.
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <SwaggerUI 
            spec={spec}
            requestInterceptor={(request) => {
              // Ensure requests go to the correct base URL
              if (request.url.startsWith('/api/')) {
                request.url = `${window.location.origin}${request.url}`;
              }
              return request;
            }}
            docExpansion="list"
            defaultModelsExpandDepth={2}
            defaultModelExpandDepth={2}
            tryItOutEnabled={true}
          />
        </div>
      </div>
    </div>
  );
}