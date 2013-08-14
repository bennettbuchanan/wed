define(function (require, exports, module) {
var chai = require("chai");
var $ = require("jquery");

var assert = chai.assert;

function reset(done) {
    $.post('/build/ajax/control', {command: 'reset'},
           function (data) {
        assert.deepEqual(data, {});
        done();
    }).fail(function () { throw Error("failed to reset"); });
}

exports.reset = reset;

function fail_on_save(done) {
    reset(function () {
        $.post('/build/ajax/control', {command: 'fail_on_save', value: 1},
               function (data) {
            assert.deepEqual(data, {});
            done();
        }).fail(function () { throw Error("failed to set fail_on_save"); });
    });
}

exports.fail_on_save = fail_on_save;

});
