sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "ccb/org/certlaborales/service/BackendService"
], (Controller, JSONModel, MessageBox, BackendService) => {
    "use strict";

    return Controller.extend("ccb.org.certlaborales.controller.Viewini", {
        onInit() {
            this._oBackendService = new BackendService();

            // Datos del empleado logueado (correo) desde el modelo global
            var oGlobalDataModel = this.getOwnerComponent().getModel("globalData");

            // Modelo local del formulario (Fecha, Tipo de Certificado, opciones a incluir)
            var oViewiniModel = new JSONModel({
                fecha: new Date(),
                idCertificado: "",
                tipoContrato: true,
                salario: false,
                cargo: false,
                area: false,
                otroPernr: ""
            });
            this.getView().setModel(oViewiniModel, "viewiniView");
        },

        /**
         * Maneja el evento "liveChange" del campo "Otro Numero de personal":
         * solo permite dígitos y limita la longitud a 8 posiciones.
         */
        onOtroPernrLiveChange(oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oEvent.getParameter("value") || "";
            var sSanitized = sValue.replace(/[^0-9]/g, "").slice(0, 8);

            if (sSanitized !== sValue) {
                oInput.setValue(sSanitized);
            }

            this.getView().getModel("viewiniView").setProperty("/otroPernr", sSanitized);
        },

        /**
         * Genera (abre) el PDF del Certificado Laboral del empleado logueado,
         * con la Fecha, el Tipo de Certificado y las opciones seleccionadas en el formulario.
         */
        onGenerar() {
            var oGlobalDataModel = this.getOwnerComponent().getModel("globalData");
            var oViewiniModel = this.getView().getModel("viewiniView");

            // Determina el número de personal a utilizar: si el usuario tiene
            // permiso (globalData>/userData/d/TienePermiso = true) y diligenció
            // un valor numérico > 0 en "Otro Numero de personal", se usa ese valor;
            // de lo contrario se usa el Pernr del empleado logueado.
            var bTienePermiso = oGlobalDataModel.getProperty("/userData/d/TienePermiso") === true;
            var sOtroPernr = oViewiniModel.getProperty("/otroPernr");
            var nOtroPernr = parseInt(sOtroPernr, 10);

            var sPernr;
            if (bTienePermiso && sOtroPernr && nOtroPernr > 0) {
                sPernr = sOtroPernr;
            } else {
                sPernr = oGlobalDataModel.getProperty("/userData/d/Pernr");
            }

            var oFecha = oViewiniModel.getProperty("/fecha");
            var sIdCertificado = oViewiniModel.getProperty("/idCertificado");
            var bTipoContrato = oViewiniModel.getProperty("/tipoContrato");
            var bSalario = oViewiniModel.getProperty("/salario");
            var bCargo = oViewiniModel.getProperty("/cargo");
            var bArea = oViewiniModel.getProperty("/area");

            if (!sPernr) {
                MessageBox.error("No se han cargado los datos del empleado. Intente recargar la aplicación.");
                return;
            }

            if (!oFecha) {
                MessageBox.warning("Seleccione una Fecha antes de generar el certificado.");
                return;
            }

            if (!sIdCertificado) {
                MessageBox.warning("Seleccione un Tipo de Certificado antes de generar el certificado.");
                return;
            }

            if (!bTipoContrato && !bSalario && !bCargo && !bArea) {
                MessageBox.warning("Seleccione al menos una opción a incluir en el certificado.");
                return;
            }

            var sFecha = this._formatFechaAAAAMMDD(oFecha);
            var oView = this.getView();

            oView.setBusy(true);

            this._oBackendService.generarCertificadoLaboral({
                Pernr: sPernr,
                Fecha: sFecha,
                IdCertificado: sIdCertificado,
                TipoContrato: bTipoContrato,
                Salario: bSalario,
                Cargo: bCargo,
                Area: bArea
            })
                .then(function (oBlob) {
                    oView.setBusy(false);
                    var sBlobUrl = URL.createObjectURL(oBlob);
                    window.open(sBlobUrl, "_blank");
                })
                .catch(function (oError) {
                    oView.setBusy(false);
                    console.error("Error al generar el certificado laboral:", oError);
                    MessageBox.error("No fue posible generar el certificado laboral. Intente nuevamente.");
                });
        },

        /**
         * Formatea un objeto Date al formato AAAAMMDD requerido por el servicio
         * GenerarCertificadoLaboral (parámetro Fecha).
         * @param {Date} oDate - Fecha seleccionada en el formulario
         * @returns {string} Fecha en formato AAAAMMDD
         * @private
         */
        _formatFechaAAAAMMDD(oDate) {
            var sYear = String(oDate.getFullYear());
            var sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
            var sDay = String(oDate.getDate()).padStart(2, "0");
            return sYear + sMonth + sDay;
        }
    });
});
