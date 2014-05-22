/**
 * @module modes/test/test_mode
 * @desc A mode for testing.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
define(/** @lends module:modes/test/test_mode*/
function (require, exports, module) {
'use strict';

var $ = require("jquery");
var util = require("wed/util");
var log = require("wed/log");
var Mode = require("wed/modes/generic/generic").Mode;
var oop = require("wed/oop");
var transformation = require("wed/transformation");
var rangy = require("rangy");
var tei_meta = require("wed/modes/generic/metas/tei_meta");
var domutil = require("wed/domutil");
var TestDecorator = require("./test_decorator").TestDecorator;
var _ = require("lodash");

var LOCAL_OPTIONS = ["ambiguous_fileDesc_insert",
                     "fileDesc_insert_needs_input"];

/**
 * This mode is purely designed to help test wed, and nothing
 * else. Don't derive anything from it and don't use it for editing.
 *
 * @class
 * @extends module:modes/generic/generic~Mode
 * @param {Object} options The options for the mode.
 */
function TestMode (options) {
    var opts = _.omit(options, LOCAL_OPTIONS);
    Mode.call(this, opts);
    this._test_mode_options = _.pick(options, LOCAL_OPTIONS);

    if (this.constructor !== TestMode)
        throw new Error("this is a test mode; don't derive from it!");

    this._wed_options.metadata = {
        name: "Test",
        authors: ["Louis-Dominique Dubeau"],
        description: "TEST MODE. DO NOT USE IN PRODUCTION!",
        license: "MPL 2.0",
        copyright:
        "2013, 2014 Mangalam Research Center for Buddhist Languages"
    };
    this._wed_options.label_levels = {
        max: 2,
        initial: 1
    };
}

oop.inherit(TestMode, Mode);

TestMode.prototype.init = function (editor) {
    Mode.prototype.init.call(this, editor);

    if (this._test_mode_options.ambiguous_fileDesc_insert) {
        // We just duplicate the transformation.
        var tr = this._tr.getTagTransformations("insert", "fileDesc");
        this._tr.addTagTransformations("insert", "fileDesc", tr);
    }
};

TestMode.prototype.getContextualActions = function (type, tag, container,
                                                    offset) {
    if (this._test_mode_options.fileDesc_insert_needs_input &&
        tag === "fileDesc" && type === "insert")
        return [new transformation.Transformation(
            this._editor, "foo", undefined, undefined, true,
            // We don't need a real handler because it will not be called.
            function () {})];

    return this._tr.getTagTransformations(type, tag);
};


TestMode.prototype.makeDecorator = function () {
    var obj = Object.create(TestDecorator.prototype);
    var args = Array.prototype.slice.call(arguments);
    args = [this, this._meta, this._options].concat(args);
    TestDecorator.apply(obj, args);
    return obj;
};


exports.Mode = TestMode;

});

//  LocalWords:  domutil metas tei oop util jquery Mangalam MPL
//  LocalWords:  Dubeau