# Changelog

## [1.0.0] - 2025-01-20

### Added
- ✨ **File Deletion Sync**: Implemented bidirectional file deletion synchronization
  - Automatically delete files from GitHub that no longer exist locally
  - Automatically delete local files that no longer exist on GitHub
  - Supports all file types: notebooks (.sy files), config files, plugins, and templates

- 📁 **Enhanced Folder Structure**: Improved organization of synced files
  - Clear separation of notebooks, config files, plugins, and templates
  - Better handling of file paths and directory structures
  - Consistent naming conventions across all file types

- 🔄 **Improved Sync Logic**: Enhanced synchronization algorithms
  - More robust handling of file comparisons
  - Better error handling and recovery mechanisms
  - Optimized performance for large repositories

- 📊 **Enhanced Status Reporting**: More detailed sync status information
  - Clear breakdown of created, updated, deleted, and skipped files
  - Better error reporting with specific file information
  - Real-time progress updates during sync operations

### Fixed
- 🐛 **Folder Structure Issues**: Resolved problems with incorrect folder generation
  - Fixed issue where notebooks folder was incorrectly generated during full sync
  - Corrected path handling for all file types
  - Improved consistency between local and remote file structures

- 🗑️ **File Deletion Problems**: Addressed issues with file cleanup
  - Fixed incomplete file deletion on both local and remote sides
  - Improved handling of edge cases in deletion workflows
  - Added safeguards to prevent accidental data loss

### Changed
- 📚 **Documentation Updates**: Comprehensive updates to all documentation
  - Updated README.md with new features and usage instructions
  - Enhanced installation and setup guides
  - Added detailed information about file deletion sync functionality

- ⚙️ **Configuration Improvements**: Refined plugin configuration options
  - Better validation of user inputs
  - Improved error messages for misconfigured settings
  - Enhanced connection testing capabilities

### Improved
- 🚀 **Performance Optimizations**: Various performance enhancements
  - Faster file processing and comparison algorithms
  - Reduced memory usage during sync operations
  - More efficient GitHub API usage to minimize rate limiting

- 🛡️ **Reliability Enhancements**: Increased stability and reliability
  - Better handling of network interruptions
  - Improved retry mechanisms for failed operations
  - Enhanced error recovery capabilities

## [0.0.1] - 2025-01-15

### Added
- 📤 Initial release with basic Git sync functionality
- 📥 Push to GitHub and Pull from GitHub support
- 🔄 Full two-way synchronization
- ⏰ Auto-sync capabilities
- 🔍 Connection testing
- 📊 Status view
- 🌐 English and Chinese language support

[1.0.0]: https://github.com/mswastik/siyuan-git-sync/releases/tag/v1.0.0
[0.0.1]: https://github.com/mswastik/siyuan-git-sync/releases/tag/v0.0.1