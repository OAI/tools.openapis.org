# Contributing

If you want to help improve this repository pick up something from the [issues list](https://github.com/OAI/Tooling/issues).

If you think something is duff, needs improvement, or is simply missing then [raise an issue](https://github.com/OAI/Tooling/issues/new/choose) and get it in the backlog. Once we discuss and agree on approach then knock yourself out.

## Structure

The project holds both the data transformation and site generation code.

As the code base is relatively simple this approach is pragmatic for now.

The structure is as follows (showing only directories):

```bash
root
│
└─── docs           # Publication folder for the site on GitHub Pages
│
└─── gulpfile.js    # Gulp build folder
│
└─── lib            # All packages...
     └─── data      # ...related to the data build
     └─── site      # ...related to the site build
src
│
└─── _data          # Source data and data transformation driven by JavaScript
│
└─── _includes      # Reused components across sites
│
└─── scripts        # JavaScript
│
└─── styles         # CSS (namely, a wrapper around TailwindCSS!)
│
└─── test
     └─── data      # Test data
     └─── lib       # All test packages...
          └─── data # ...related to the data build
          └─── site # ...related to the site build
```

## Builds

A few notes on the `build:data:*` vs `build:site` build approach.

### `build:data:*`

The creation of `src/_data/tools.yaml` is run through `gulp`. The design principle has generally been one of separation-of-concern, so different tools processor are written in different packages and `gulp` itself can be replaced with almost zero re-engineering. [`gulpfile.js/index.js`](gulpfile.js/index.js) therefore references [`lib/index.js`](lib/data/index.js), with the `gulpfile.js/index.js` just being a wrapper.

If you work on the `data` build please ensure you adopt this approach and:

* Ensure any "logic" is always built in `lib` and not `gulpfile.js`.
* Reference your package from `gulpfile.js`
* Add any build metadata i.e. static references to `gulpfile.js/metadata.json`[gulpfile.js/metadata.json].

### `build:site`

The site is built using Eleventy and Webpack, with Eleventy obviously driving the static site generation and Webpack the JavaScript and CSS assets.

The design approach has been to use JavaScript to drive data transformation where required. For example the package [`get-tools-by-category.js`](lib/site/get-tools-by-category.js) drives the creation of each category page, and is included by [`categories.js`](src/_data/categories.js).

Please therefore:

* Consider using JavaScript over over transformation approaches for the sake of consistency.
* Create a package in `lib/site` that drives data transformation and then include it in a package in `src/_data`.
* Write a unit test for your package in `test/lib/site`.