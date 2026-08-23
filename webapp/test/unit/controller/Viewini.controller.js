/*global QUnit*/

sap.ui.define([
	"ccb/org/certlaborales/controller/Viewini.controller"
], function (Controller) {
	"use strict";

	QUnit.module("Viewini Controller");

	QUnit.test("I should test the Viewini controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
