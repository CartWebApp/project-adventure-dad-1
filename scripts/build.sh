pnpm install # netlify might do this for us, not sure...
node ./scripts/image-loader.js
mkdir -p ./dist
cp -a -r ./src/* ./dist
rm ./dist/*.js # remove all js files, as rollup will add them for us
rm ./dist/*.ts # remove ts files, they serve no purpose in prod
rm ./dist/*.css # remove css files, they'll be added through lightningcss
pnpx lightningcss-cli --minify --targets ">= 0.25%" ./src/styles.css -o ./dist/styles.css # minify css
pnpx rollup --config ./rollup.config.js # minify + bundle js
cp -a -r ./assets/* ./dist # copy assets to dist
