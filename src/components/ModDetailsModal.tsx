import { useState, useEffect } from 'react';

interface ModDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mod: {
    name: string;
    author?: string;
    version: string;
    compatibility?: string;
    description: string;
    imageURL?: string;
    readmeURL?: string;
    files?: {
      exmodz?: string;
      download_url?: string;
      png?: string;
    };
    source?: string;
    installed?: boolean;
    enabled?: boolean;
    id?: string;
  };
  onInstall?: () => void;
  onDownloadPak?: () => void;
  isInstalling?: boolean;
  isInstalled?: boolean;
}

export default function ModDetailsModal({ 
  isOpen, 
  onClose, 
  mod, 
  onInstall, 
  onDownloadPak,
  isInstalling, 
  isInstalled 
}: ModDetailsModalProps) {
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [loadingReadme, setLoadingReadme] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchReadmeContent();
    }
  }, [isOpen]);

  const fetchReadmeContent = async () => {
    if (!mod.readmeURL) {
      setReadmeContent('No additional details available for this mod.');
      return;
    }

    setLoadingReadme(true);
    try {
      // For GitHub URLs, convert to raw content
      let rawUrl = mod.readmeURL;
      if (rawUrl.includes('github.com') && rawUrl.includes('blob/')) {
        rawUrl = rawUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      }
      
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(rawUrl)}`);
      if (response.ok) {
        const content = await response.text();
        setReadmeContent(content);
      } else {
        setReadmeContent('Unable to load mod details. Please visit the mod page directly.');
      }
    } catch (error) {
      console.error('Failed to fetch readme:', error);
      setReadmeContent('Error loading mod details.');
    } finally {
      setLoadingReadme(false);
    }
  };

  const formatReadmeContent = (content: string) => {
    // Basic markdown to HTML conversion for display
    return content
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">$1</h3>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>')
      .replace(/`(.*?)`/gim, '<code class="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/\n\n/gim, '<br><br>')
      .replace(/\n/gim, '<br>');
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-8 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
          <div className="flex items-start space-x-6 flex-1">
            <img
              src={mod.imageURL || '/default-mod-image.svg'}
              alt={mod.name}
              className="w-32 h-24 object-cover rounded-lg shadow-md"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/default-mod-image.svg';
              }}
            />
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                {mod.name}
              </h2>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p><span className="font-medium">Author:</span> {mod.author || 'Unknown'}</p>
                <p><span className="font-medium">Version:</span> {mod.version}</p>
                {(mod as any).compatibility && (
                  <p><span className="font-medium">Compatibility:</span> {(mod as any).compatibility}</p>
                )}
                <p><span className="font-medium">Source:</span> 
                  <span className="ml-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                    {(mod as any).source ? (mod as any).source.toUpperCase() : 'LOCAL'}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Description</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{mod.description}</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Details</h3>
            {loadingReadme ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600 dark:text-gray-400">Loading details...</span>
              </div>
            ) : readmeContent ? (
              <div 
                className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300"
                dangerouslySetInnerHTML={{ __html: formatReadmeContent(readmeContent) }}
              />
            ) : (
              <p className="text-gray-500 dark:text-gray-400 italic">No additional details available.</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-b-xl">
          <div className="flex space-x-3">
            {mod.readmeURL && (
              <a
                href={mod.readmeURL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View on GitHub
              </a>
            )}
          </div>

          <div className="flex space-x-4">
            {isInstalled && onDownloadPak && (
              <button
                onClick={onDownloadPak}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download .pak
              </button>
            )}
            
            {!isInstalled && onInstall && (
              <button
                onClick={onInstall}
                disabled={isInstalling}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center font-medium"
              >
                {isInstalling ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Installing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Install Mod
                  </>
                )}
              </button>
            )}

            {isInstalled && (
              <span className="px-6 py-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg font-medium">
                ✓ Installed
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}