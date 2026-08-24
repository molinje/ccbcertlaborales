sap.ui.define([
    "sap/ui/core/UIComponent",
    "ccb/org/certlaborales/model/models",
    "ccb/org/certlaborales/service/BackendService",
    "sap/ui/model/json/JSONModel"
], (UIComponent, models, BackendService, JSONModel) => {
    "use strict";

    return UIComponent.extend("ccb.org.certlaborales.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();

            // Obtener datos del usuario logueado desde Work Zone / Fiori Launchpad
            var oUserData = { id: "", email: "", fullName: "" };
            if (sap.ushell && sap.ushell.Container) {
                var oUserInfo = sap.ushell.Container.getService("UserInfo");
                oUserData.id       = oUserInfo.getId()       || "";
                oUserData.email    = oUserInfo.getEmail()    || "";
                oUserData.fullName = oUserInfo.getFullName() || "";
            }

            console.log("Datos del usuario logueado:", oUserData);

            // Crear modelo global para datos del servicio
            var oGlobalDataModel = new JSONModel({
                userLogin: oUserData,  // Datos del usuario actual (Work Zone / Launchpad)
                userData: null,        // Respuesta del servicio DatosBasicosCertLabSet
                tiposCertificado: []   // Colección de Tipos de Certificado Laboral (TipoCertificadoLaboralSet)
            });
            this.setModel(oGlobalDataModel, "globalData");

            // Cargar los datos básicos / certificado laboral del empleado logueado
            var oBackendService = new BackendService();
            oBackendService.GetDataEmployee(oUserData.email)
                .then(function (oData) {
                    var oEmployeeData = (oData && oData.d) || oData;
                    //oGlobalDataModel.setProperty("/userData", oEmployeeData);
                    oGlobalDataModel.setProperty("/userData", oData);
                    if (!oData || !oData.d) {
                        console.error("Datos del empleado no disponibles");
                    }
                })
                .catch(function (oError) {
                    console.error("Error al consultar los datos del empleado:", oError);
                });

            // Cargar una única vez la colección de Tipos de Certificado Laboral
            oBackendService.getTiposCertificado(oUserData.email)
                .then(function (aTiposCertificado) {
                    oGlobalDataModel.setProperty("/tiposCertificado", aTiposCertificado);
                })
                .catch(function (oError) {
                    console.error("Error al consultar los tipos de certificado laboral:", oError);
                });
        }
    });
});
