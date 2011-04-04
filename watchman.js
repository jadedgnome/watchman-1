(function() {
  var cli, exec, fs, path, winston;
  cli = require('cli');
  fs = require('fs');
  path = require('path');
  winston = require('winston');
  exec = require('child_process');
  exec = exec.exec;
  cli.setUsage('watchman [options] target action');
  cli.parse({
    "ignore-hidden": ['i', "Do not watch hidden files"],
    "rate-limit": ['r', "Rate limit actions", "string", null],
    "queue-size": ['q', "Action queue size", "int", 1]
  });
  cli.main(function(args, options) {
    var action, actionQueue, directoryWatcher, execAction, execFromQueue, find_files, queueAction, rate, rateMap, target, testHidden, useQueue, watched, watcher;
    if (args.length < 2) {
      console.log("Please specify a target and action");
      return;
    }
    rateMap = {
      s: 1000,
      m: 1000 * 60,
      h: 1000 * 60 * 60
    };
    target = args[0];
    action = args[1];
    watched = {};
    useQueue = false;
    actionQueue = [];
    queueAction = function() {
      if (actionQueue.length < options["queue-size"]) {
        return actionQueue.push(action);
      }
    };
    execFromQueue = function() {
      var a, _i, _len;
      for (_i = 0, _len = actionQueue.length; _i < _len; _i++) {
        a = actionQueue[_i];
        execAction(a);
      }
      return actionQueue = [];
    };
    execAction = function(toExec) {
      toExec != null ? toExec : toExec = action;
      winston.info("Running action...");
      return exec(toExec, function(error, stdout, stderr) {
        winston.info("stderr: " + stderr);
        return winston.info("stdout: " + stdout);
      });
    };
    watcher = function(file) {
      if (file in watched) {
        return;
      }
      watched[file] = true;
      winston.info("watching: " + file);
      return fs.watchFile(file, {
        persistent: true,
        interval: 500
      }, function(curr, prev) {
        if (curr.size === prev.size && curr.mtime.getTime() === prev.mtime.getTime()) {
          return;
        }
        winston.info("File changed: " + file);
        if (useQueue) {
          return queueAction();
        } else {
          return execAction();
        }
      });
    };
    directoryWatcher = function(dir) {
      if (dir in watched) {
        return;
      }
      watched[dir] = true;
      winston.info("watching directory: " + dir);
      return fs.watchFile(dir, {
        persistent: true,
        interval: 500
      }, function(curr, prev) {
        return find_files(dir);
      });
    };
    testHidden = function(file) {
      return options["ignore-hidden"] && file[0] === '.';
    };
    if (options["rate-limit"] != null) {
      useQueue = true;
      rate = options["rate-limit"];
      rate = parseInt(rate.slice(0, -1)) * rateMap[rate.slice(-1)];
      setInterval(execFromQueue, rate);
    }
    find_files = function(target) {
      return path.exists(target, function(exists) {
        if (!exists) {
          throw new ("Target file not found: " + target);
        }
        return fs.stat(target, function(err, stats) {
          if (stats.isDirectory()) {
            directoryWatcher(target);
            return fs.readdir(target, function(err, files) {
              var file, _i, _len, _results;
              _results = [];
              for (_i = 0, _len = files.length; _i < _len; _i++) {
                file = files[_i];
                if (!testHidden(file)) {
                  _results.push(find_files(target + "/" + file));
                }
              }
              return _results;
            });
          } else {
            if (!testHidden(target)) {
              return watcher(target);
            }
          }
        });
      });
    };
    return find_files(target);
  });
}).call(this);