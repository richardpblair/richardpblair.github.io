This is my portfolio website that I have customized from the BootstrapMade templates listed below.

Template Name: SnapFolio  
Template URL: https://bootstrapmade.com/snapfolio-bootstrap-portfolio-template/

Template Name: MyPage  
Template URL: https://bootstrapmade.com/mypage-bootstrap-personal-template/

Author: BootstrapMade.com  
License: https://bootstrapmade.com/license/

## Build workflow

This project now ships a small Node-based build script that trims comments and whitespace from the primary CSS and JavaScript bundles and writes cache-busted versions to `dist/`.

1. Ensure you have Node.js 18 or newer available.
2. Run `npm run build` from the project root.
3. The command regenerates minified files with hashed filenames (e.g., `dist/main-*.css`, `dist/main-*.js`) along with their corresponding source maps and an updated `dist/manifest.json`.
4. Commit the freshly built assets so the HTML pages continue to reference the current hashed filenames.

The HTML documents already point to the generated assets in `dist/`, so no additional steps are required after running the build.
## Front-end scripts

All JavaScript helpers live in `assets/js/`. Key entry points:

* `assets/js/main.js` keeps the template behaviour (navigation toggle, scrollspy, counters, skills progress, etc.). Reduced-motion preferences are respected when animating counters and progress bars.
* `assets/js/animations.js` is a lightweight controller that removes AOS attributes when motion should be suppressed and conditionally imports optional effects.
* `assets/js/hero-tilt.js` powers the hero illustration tilt/parallax effect. It is only loaded on pages that contain the hero image wrapper.

Scripts are loaded with `<script type="module">` tags at the end of the document so the browser can skip features that are not needed on a page (for example, pages without the hero section will never download the tilt module).

## HTML structure notes

Section markers that used to be embedded as HTML comments were removed from `index.html` to keep the delivered markup lean. Use the semantic section IDs (`#hero`, `#about`, `#skills`, etc.) when you need to navigate or hook into a specific area of the page.
