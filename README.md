This is my portfolio website that I have customized from the below template.

Template Name: SnapFolio
Template URL: https://bootstrapmade.com/snapfolio-bootstrap-portfolio-template/
Author: BootstrapMade.com
License: https://bootstrapmade.com/license/

## Build workflow

This project now ships a small Node-based build script that trims comments and whitespace from the primary CSS and JavaScript bundles and writes cache-busted versions to `dist/`.

1. Ensure you have Node.js 18 or newer available.
2. Run `npm run build` from the project root.
3. The command regenerates minified files with hashed filenames (e.g., `dist/main-*.css`, `dist/main-*.js`, `dist/bg-net-*.js`) along with their corresponding source maps and an updated `dist/manifest.json`.
4. Commit the freshly built assets so the HTML pages continue to reference the current hashed filenames.

The HTML documents already point to the generated assets in `dist/`, so no additional steps are required after running the build.
