(function() {
  var Promise, _, breakingConfigKeys, coerce, configKeys, convertRelativeToAbsolutePaths, cypressEnvRe, dashesOrUnderscoresRe, debug, deepDiff, defaults, errors, everythingAfterFirstEqualRe, folders, fs, isCypressEnvLike, oneOrMoreSpacesRe, origin, path, pathHelpers, scaffold, settings, toWords, v, validate, validateFile, validateNoBreakingConfig, validationRules;

  _ = require("lodash");

  path = require("path");

  Promise = require("bluebird");

  deepDiff = require("return-deep-diff");

  errors = require("./errors");

  scaffold = require("./scaffold");

  fs = require("./util/fs");

  origin = require("./util/origin");

  coerce = require("./util/coerce");

  settings = require("./util/settings");

  v = require("./util/validation");

  debug = require("debug")("cypress:server:config");

  pathHelpers = require("./util/path_helpers");

  cypressEnvRe = /^(cypress_)/i;

  dashesOrUnderscoresRe = /^(_-)+/;

  oneOrMoreSpacesRe = /\s+/;

  everythingAfterFirstEqualRe = /=(.+)/;

  toWords = function(str) {
    return str.trim().split(oneOrMoreSpacesRe);
  };

  isCypressEnvLike = function(key) {
    return cypressEnvRe.test(key) && key !== "CYPRESS_ENV";
  };

  folders = toWords("fileServerFolder   fixturesFolder   integrationFolder   pluginsFile\nscreenshotsFolder  supportFile      supportFolder       unitFolder\nvideosFolder");

  configKeys = toWords("animationDistanceThreshold      fileServerFolder\nbaseUrl                         fixturesFolder\nchromeWebSecurity\nmodifyObstructiveCode           integrationFolder\nenv                             pluginsFile\nhosts                           screenshotsFolder\nnumTestsKeptInMemory            supportFile\nport                            supportFolder\nreporter                        videosFolder\nreporterOptions\ntestFiles                       defaultCommandTimeout\ntrashAssetsBeforeRuns           execTimeout\nblacklistHosts                  pageLoadTimeout\nuserAgent                       requestTimeout\nviewportWidth                   responseTimeout\nviewportHeight                  taskTimeout\nvideo\nvideoCompression\nvideoUploadOnPasses\nwatchForFileChanges\nwaitForAnimations");

  breakingConfigKeys = toWords("videoRecording\nscreenshotOnHeadlessFailure\ntrashAssetsBeforeHeadlessRuns");

  defaults = {
    port: null,
    hosts: null,
    morgan: true,
    baseUrl: null,
    socketId: null,
    userAgent: null,
    isTextTerminal: false,
    reporter: "spec",
    reporterOptions: null,
    blacklistHosts: null,
    clientRoute: "/__/",
    xhrRoute: "/xhrs/",
    socketIoRoute: "/__socket.io",
    socketIoCookie: "__socket.io",
    reporterRoute: "/__cypress/reporter",
    ignoreTestFiles: "*.hot-update.js",
    testFiles: "**/*.*",
    defaultCommandTimeout: 4000,
    requestTimeout: 5000,
    responseTimeout: 30000,
    pageLoadTimeout: 60000,
    execTimeout: 60000,
    taskTimeout: 60000,
    video: true,
    videoCompression: 32,
    videoUploadOnPasses: true,
    modifyObstructiveCode: true,
    chromeWebSecurity: true,
    waitForAnimations: true,
    animationDistanceThreshold: 5,
    numTestsKeptInMemory: 50,
    watchForFileChanges: true,
    trashAssetsBeforeRuns: true,
    autoOpen: false,
    viewportWidth: 1000,
    viewportHeight: 660,
    fileServerFolder: "",
    videosFolder: "cypress/videos",
    supportFile: "cypress/support",
    fixturesFolder: "cypress/fixtures",
    integrationFolder: "cypress/integration",
    screenshotsFolder: "cypress/screenshots",
    namespace: "__cypress",
    pluginsFile: "cypress/plugins",
    javascripts: []
  };

  validationRules = {
    animationDistanceThreshold: v.isNumber,
    baseUrl: v.isFullyQualifiedUrl,
    blacklistHosts: v.isStringOrArrayOfStrings,
    modifyObstructiveCode: v.isBoolean,
    chromeWebSecurity: v.isBoolean,
    defaultCommandTimeout: v.isNumber,
    env: v.isPlainObject,
    execTimeout: v.isNumber,
    fileServerFolder: v.isString,
    fixturesFolder: v.isStringOrFalse,
    ignoreTestFiles: v.isStringOrArrayOfStrings,
    integrationFolder: v.isString,
    numTestsKeptInMemory: v.isNumber,
    pageLoadTimeout: v.isNumber,
    pluginsFile: v.isStringOrFalse,
    port: v.isNumber,
    reporter: v.isString,
    requestTimeout: v.isNumber,
    responseTimeout: v.isNumber,
    testFiles: v.isString,
    supportFile: v.isStringOrFalse,
    taskTimeout: v.isNumber,
    trashAssetsBeforeRuns: v.isBoolean,
    userAgent: v.isString,
    videoCompression: v.isNumberOrFalse,
    video: v.isBoolean,
    videoUploadOnPasses: v.isBoolean,
    videosFolder: v.isString,
    viewportHeight: v.isNumber,
    viewportWidth: v.isNumber,
    waitForAnimations: v.isBoolean,
    watchForFileChanges: v.isBoolean
  };

  convertRelativeToAbsolutePaths = function(projectRoot, obj, defaults) {
    if (defaults == null) {
      defaults = {};
    }
    return _.reduce(folders, function(memo, folder) {
      var val;
      val = obj[folder];
      if ((val != null) && val !== false) {
        memo[folder] = path.resolve(projectRoot, val);
      }
      return memo;
    }, {});
  };

  validateNoBreakingConfig = function(cfg) {
    return _.each(breakingConfigKeys, function(key) {
      if (_.has(cfg, key)) {
        switch (key) {
          case "screenshotOnHeadlessFailure":
            return errors["throw"]("SCREENSHOT_ON_HEADLESS_FAILURE_REMOVED");
          case "trashAssetsBeforeHeadlessRuns":
            return errors["throw"]("RENAMED_CONFIG_OPTION", key, "trashAssetsBeforeRuns");
          case "videoRecording":
            return errors["throw"]("RENAMED_CONFIG_OPTION", key, "video");
        }
      }
    });
  };

  validate = function(cfg, onErr) {
    return _.each(cfg, function(value, key) {
      var result, validationFn;
      if (validationFn = validationRules[key]) {
        if (value !== defaults[key]) {
          result = validationFn(key, value);
          if (result !== true) {
            return onErr(result);
          }
        }
      }
    });
  };

  validateFile = function(file) {
    return function(settings) {
      return validate(settings, function(errMsg) {
        return errors["throw"]("SETTINGS_VALIDATION_ERROR", file, errMsg);
      });
    };
  };

  module.exports = {
    getConfigKeys: function() {
      return configKeys;
    },
    whitelist: function(obj) {
      if (obj == null) {
        obj = {};
      }
      return _.pick(obj, configKeys.concat(breakingConfigKeys));
    },
    get: function(projectRoot, options) {
      if (options == null) {
        options = {};
      }
      return Promise.all([settings.read(projectRoot).then(validateFile("cypress.json")), settings.readEnv(projectRoot).then(validateFile("cypress.env.json"))]).spread((function(_this) {
        return function(settings, envFile) {
          return _this.set({
            projectName: _this.getNameFromRoot(projectRoot),
            projectRoot: projectRoot,
            config: settings,
            envFile: envFile,
            options: options
          });
        };
      })(this));
    },
    set: function(obj) {
      var config, envFile, options, projectName, projectRoot;
      if (obj == null) {
        obj = {};
      }
      projectRoot = obj.projectRoot, projectName = obj.projectName, config = obj.config, envFile = obj.envFile, options = obj.options;
      if (config == null) {
        config = {};
      }
      config.envFile = envFile;
      config.projectRoot = projectRoot;
      config.projectName = projectName;
      return this.mergeDefaults(config, options);
    },
    mergeDefaults: function(config, options) {
      var resolved, url;
      if (config == null) {
        config = {};
      }
      if (options == null) {
        options = {};
      }
      resolved = {};
      _.extend(config, _.pick(options, "morgan", "isTextTerminal", "socketId", "report", "browsers"));
      _.chain(this.whitelist(options)).omit("env").each(function(val, key) {
        resolved[key] = "cli";
        config[key] = val;
      }).value();
      if (url = config.baseUrl) {
        config.baseUrl = _.trimEnd(url, "/");
      }
      _.defaults(config, defaults);
      config.env = this.parseEnv(config, options.env, resolved);
      config.cypressEnv = process.env["CYPRESS_ENV"];
      delete config.envFile;
      if (config.isTextTerminal) {
        config.watchForFileChanges = false;
        config.numTestsKeptInMemory = 0;
      }
      config = this.setResolvedConfigValues(config, defaults, resolved);
      if (config.port) {
        config = this.setUrls(config);
      }
      config = this.setAbsolutePaths(config, defaults);
      config = this.setParentTestsPaths(config);
      validate(config, function(errMsg) {
        return errors["throw"]("CONFIG_VALIDATION_ERROR", errMsg);
      });
      validateNoBreakingConfig(config);
      return this.setSupportFileAndFolder(config).then(this.setPluginsFile).then(this.setScaffoldPaths);
    },
    setResolvedConfigValues: function(config, defaults, resolved) {
      var obj;
      obj = _.clone(config);
      obj.resolved = this.resolveConfigValues(config, defaults, resolved);
      return obj;
    },
    updateWithPluginValues: function(cfg, overrides) {
      var diffs, setResolvedOn;
      if (overrides == null) {
        overrides = {};
      }
      diffs = deepDiff(cfg, overrides, true);
      setResolvedOn = function(resolvedObj, obj) {
        return _.each(obj, function(val, key) {
          if (_.isObject(val)) {
            return setResolvedOn(resolvedObj[key], val);
          } else {
            return resolvedObj[key] = {
              value: val,
              from: "plugin"
            };
          }
        });
      };
      setResolvedOn(cfg.resolved, diffs);
      return _.defaultsDeep(diffs, cfg);
    },
    resolveConfigValues: function(config, defaults, resolved) {
      if (resolved == null) {
        resolved = {};
      }
      return _.chain(config).pick(configKeys).mapValues(function(val, key) {
        var r, source;
        source = function(s) {
          return {
            value: val,
            from: s
          };
        };
        switch (false) {
          case !(r = resolved[key]):
            if (_.isObject(r)) {
              return r;
            } else {
              return source(r);
            }
            break;
          case !!_.isEqual(config[key], defaults[key]):
            return source("config");
          default:
            return source("default");
        }
      }).value();
    },
    setScaffoldPaths: function(obj) {
      obj = _.clone(obj);
      obj.integrationExampleName = scaffold.integrationExampleName();
      obj.integrationExamplePath = path.join(obj.integrationFolder, obj.integrationExampleName);
      debug("set scaffold paths");
      return scaffold.fileTree(obj).then(function(fileTree) {
        debug("got file tree");
        obj.scaffoldedFiles = fileTree;
        return obj;
      });
    },
    setSupportFileAndFolder: function(obj) {
      var sf;
      if (!obj.supportFile) {
        return Promise.resolve(obj);
      }
      obj = _.clone(obj);
      sf = obj.supportFile;
      debug("setting support file " + sf);
      debug("for project root " + obj.projectRoot);
      return Promise["try"](function() {
        return obj.supportFile = require.resolve(sf);
      }).then(function() {
        if (pathHelpers.checkIfResolveChangedRootFolder(obj.supportFile, sf)) {
          debug("require.resolve switched support folder from %s to %s", sf, obj.supportFile);
          obj.supportFile = path.join(sf, path.basename(obj.supportFile));
          return fs.pathExists(obj.supportFile).then(function(found) {
            if (!found) {
              errors["throw"]("SUPPORT_FILE_NOT_FOUND", obj.supportFile);
            }
            return debug("switching to found file %s", obj.supportFile);
          });
        }
      })["catch"]({
        code: "MODULE_NOT_FOUND"
      }, function() {
        debug("support file %s does not exist", sf);
        if (sf === path.resolve(obj.projectRoot, defaults.supportFile)) {
          debug("support file is default, check if " + (path.dirname(sf)) + " exists");
          return fs.pathExists(sf).then(function(found) {
            if (found) {
              debug("support folder exists, set supportFile to false");
              obj.supportFile = false;
            } else {
              debug("support folder does not exist, set to default index.js");
              obj.supportFile = path.join(sf, "index.js");
            }
            return obj;
          });
        } else {
          debug("support file is not default");
          return errors["throw"]("SUPPORT_FILE_NOT_FOUND", path.resolve(obj.projectRoot, sf));
        }
      }).then(function() {
        if (obj.supportFile) {
          obj.supportFolder = path.dirname(obj.supportFile);
          debug("set support folder " + obj.supportFolder);
        }
        return obj;
      });
    },
    setPluginsFile: function(obj) {
      var pluginsFile;
      if (!obj.pluginsFile) {
        return Promise.resolve(obj);
      }
      obj = _.clone(obj);
      pluginsFile = obj.pluginsFile;
      debug("setting plugins file " + pluginsFile);
      debug("for project root " + obj.projectRoot);
      return Promise["try"](function() {
        obj.pluginsFile = require.resolve(pluginsFile);
        return debug("set pluginsFile to " + obj.pluginsFile);
      })["catch"]({
        code: "MODULE_NOT_FOUND"
      }, function() {
        debug("plugins file does not exist");
        if (pluginsFile === path.resolve(obj.projectRoot, defaults.pluginsFile)) {
          debug("plugins file is default, check if " + (path.dirname(pluginsFile)) + " exists");
          return fs.pathExists(pluginsFile).then(function(found) {
            if (found) {
              debug("plugins folder exists, set pluginsFile to false");
              obj.pluginsFile = false;
            } else {
              debug("plugins folder does not exist, set to default index.js");
              obj.pluginsFile = path.join(pluginsFile, "index.js");
            }
            return obj;
          });
        } else {
          debug("plugins file is not default");
          return errors["throw"]("PLUGINS_FILE_ERROR", path.resolve(obj.projectRoot, pluginsFile));
        }
      })["return"](obj);
    },
    setParentTestsPaths: function(obj) {
      var prd, ptfd, ref;
      obj = _.clone(obj);
      ptfd = obj.parentTestsFolder = path.dirname(obj.integrationFolder);
      prd = path.dirname((ref = obj.projectRoot) != null ? ref : "");
      obj.parentTestsFolderDisplay = path.relative(prd, ptfd);
      return obj;
    },
    setAbsolutePaths: function(obj, defaults) {
      var pr;
      obj = _.clone(obj);
      if (pr = obj.projectRoot) {
        _.extend(obj, convertRelativeToAbsolutePaths(pr, obj, defaults));
      }
      return obj;
    },
    setUrls: function(obj) {
      var proxyUrl, rootUrl;
      obj = _.clone(obj);
      proxyUrl = "http://localhost:" + obj.port;
      rootUrl = obj.baseUrl ? origin(obj.baseUrl) : proxyUrl;
      _.extend(obj, {
        proxyUrl: proxyUrl,
        browserUrl: rootUrl + obj.clientRoute,
        reporterUrl: rootUrl + obj.reporterRoute,
        xhrUrl: obj.namespace + obj.xhrRoute
      });
      return obj;
    },
    parseEnv: function(cfg, envCLI, resolved) {
      var configFromEnv, envCfg, envFile, envProc, envVars, matchesConfigKey, ref, ref1, ref2, resolveFrom;
      if (resolved == null) {
        resolved = {};
      }
      envVars = resolved.env = {};
      resolveFrom = function(from, obj) {
        if (obj == null) {
          obj = {};
        }
        return _.each(obj, function(val, key) {
          return envVars[key] = {
            value: val,
            from: from
          };
        });
      };
      envCfg = (ref = cfg.env) != null ? ref : {};
      envFile = (ref1 = cfg.envFile) != null ? ref1 : {};
      envProc = (ref2 = this.getProcessEnvVars(process.env)) != null ? ref2 : {};
      envCLI = envCLI != null ? envCLI : {};
      matchesConfigKey = function(key) {
        if (_.has(cfg, key)) {
          return key;
        }
        key = key.toLowerCase().replace(dashesOrUnderscoresRe, "");
        key = _.camelCase(key);
        if (_.has(cfg, key)) {
          return key;
        }
      };
      configFromEnv = _.reduce(envProc, function(memo, val, key) {
        var cfgKey;
        if (cfgKey = matchesConfigKey(key)) {
          if (resolved[cfgKey] !== "cli") {
            cfg[cfgKey] = val;
            resolved[cfgKey] = {
              value: val,
              from: "env"
            };
          }
          memo.push(key);
        }
        return memo;
      }, []);
      envProc = _.omit(envProc, configFromEnv);
      resolveFrom("config", envCfg);
      resolveFrom("envFile", envFile);
      resolveFrom("env", envProc);
      resolveFrom("cli", envCLI);
      return _.extend(envCfg, envFile, envProc, envCLI);
    },
    getProcessEnvVars: function(obj) {
      var normalize;
      if (obj == null) {
        obj = {};
      }
      normalize = function(key) {
        return key.replace(cypressEnvRe, "");
      };
      return _.reduce(obj, function(memo, value, key) {
        if (isCypressEnvLike(key)) {
          memo[normalize(key)] = coerce(value);
        }
        return memo;
      }, {});
    },
    getNameFromRoot: function(root) {
      if (root == null) {
        root = "";
      }
      return path.basename(root);
    }
  };

}).call(this);
