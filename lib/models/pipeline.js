'use strict';

var Promise = require('ember-cli/lib/ext/promise');
var _       = require('lodash-node');

var chalk = require('chalk');
var blue  = chalk.blue;
var red   = chalk.red;

/* This is a generic implementation of a pipeline with ordered, promise-aware hooks,
 * pleasant logging, and failure handling. It should not have any "deployment" domain
 * logic or semantics, and is a candidate for extraction to its own npm module.
 */
function Pipeline(hookNames, options) {
  hookNames = hookNames || [];
  options = options || {};

  this._ui = options.ui;

  this._pipelineHooks = hookNames.reduce(function(pipelineHooks, hookName) {
    pipelineHooks[hookName] = [];

    return pipelineHooks;
  }, { didFail: [] });
}

Pipeline.prototype.register = function(hookName, fn) {
  var ui            = this._ui;
  var pipelineHooks = this._pipelineHooks;

  if (typeof fn === 'function') {
    fn = {
      name: 'anonymous function',
      fn: fn
    };
  }

  if (pipelineHooks[hookName]) {
    if (ui.verbose) {
      ui.write(blue('Registering hook -> ' + hookName + '[' + fn.name + ']\n'));
    }

    pipelineHooks[hookName].push(fn);
  }
};

Pipeline.prototype.execute = function(context) {
  context = context || { };

  var ui = this._ui;
  var hooks = this._hooksWithoutDidFail(this.hookNames());
  var ProgressBar = require('progress');
  if (ui.verbose) {
    ui.write(blue('Executing pipeline\n'));
  } else {
    ui.progressBar = new ProgressBar('deploy progress [:bar] :percent', {
      total: this._hooksCount(this._hooksWithoutConfigure(hooks))
    });
  }

  return hooks.reduce(this._addHookExecutionPromiseToPipelinePromiseChain.bind(this, ui), Promise.resolve(context))
  .then(this._notifyPipelineCompletion.bind(this, ui))
  .catch(this._handlePipelineFailure.bind(this, ui, context))
  .catch(this._abortPipelineExecution.bind(this, ui));
};

Pipeline.prototype.hookNames = function() {
  return Object.keys(this._pipelineHooks);
};

Pipeline.prototype._addHookExecutionPromiseToPipelinePromiseChain = function(ui, promise, hookName) {
  var self = this;
  return promise
  .then(this._notifyPipelineHookExecution.bind(this, ui, hookName))
  .then(function(context){
    try {
      return self._executeHook(hookName, context);
    } catch(error) {
      return Promise.reject(error);
    }
  });
};

Pipeline.prototype._hooksWithoutDidFail = function(hooks) {
  return hooks.filter(function(hook) {
    return hook !== 'didFail';
  });
};

Pipeline.prototype._hooksWithoutConfigure = function(hooks) {
  return hooks.filter(function(hook) {
    return hook !== 'configure';
  });
};

Pipeline.prototype._hooksCount = function(hooks) {
  return hooks.reduce(function(sum, hookName) {
    var hookFunctions = this._pipelineHooks[hookName];
    return sum + hookFunctions.length;
  }.bind(this), 0);
};

Pipeline.prototype._handlePipelineFailure = function(ui, context, error) {
  if (ui.verbose) {
    ui.write(red('|\n'));
    ui.write(red('+- didFail\n'));
  }
  ui.write(red(error + '\n' + (error ? error.stack : null)));
  return this._executeHook('didFail', context)
    .then(Promise.reject.bind(this, error));
};

Pipeline.prototype._abortPipelineExecution = function(ui/*, error */) {
  if (ui.verbose) {
    ui.write(blue('|\n'));
  }
  ui.write(red('Pipeline aborted\n'));
  return Promise.reject();
};

Pipeline.prototype._notifyPipelineCompletion = function(ui) {
  if (ui.verbose) {
    ui.write(blue('|\n'));
    ui.write(blue('Pipeline complete\n'));
  }
};

Pipeline.prototype._notifyPipelineHookExecution = function(ui, hookName, context) {
  if (ui.verbose) {
    ui.write(blue('|\n'));
    ui.write(blue('+- ' + hookName + '\n'));
  }
  return context;
};

Pipeline.prototype._executeHook = function(hookName, context) {
  var ui            = this._ui;
  var hookFunctions = this._pipelineHooks[hookName];

  return hookFunctions.reduce(this._addPluginHookExecutionPromiseToHookPromiseChain.bind(this, ui, context, hookName), Promise.resolve(context));
};

Pipeline.prototype._addPluginHookExecutionPromiseToHookPromiseChain = function(ui, context, hookName, promise, fnObject) {
  return promise
    .then(this._notifyPipelinePluginHookExecution.bind(this, ui, fnObject, hookName))
    .then(this._mergePluginHookResultIntoContext.bind(this, context));
};

Pipeline.prototype._notifyPipelinePluginHookExecution = function(ui, fnObject, hookName, context) {
  if (ui.verbose) {
    ui.write(blue('|  |\n'));
    ui.write(blue('|  +- ' + fnObject.name + '\n'));
  } else {
    if (hookName !== 'configure') {
      ui.progressBar.tick();
    }
  }

  return fnObject.fn(context);
};

Pipeline.prototype._mergePluginHookResultIntoContext = function(context,result) {
  return _.merge(context, result, function(a, b) {
    if (_.isArray(a)) {
      return a.concat(b);
    }
  });
};

module.exports = Pipeline;
