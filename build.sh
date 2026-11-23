#!/bin/sh
# Rebuild js/app.bundle.js after editing js/app.js or js/jewel3d.js.
# (Editing prices/text in js/data.js does NOT need a rebuild.)
npx --yes esbuild@0.24.0 js/app.js --bundle --format=iife --minify --target=es2019 --outfile=js/app.bundle.js
