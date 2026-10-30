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
                otroPernr: "",
                descripcion: ""
            });
            this.getView().setModel(oViewiniModel, "viewiniView");
        },

        /**
         * Maneja el evento "liveChange" del campo "Otro Numero de personal":
         * solo permite dígitos y limita la longitud a 8 posiciones. Ya NO
         * dispara la consulta al backend en cada tecla mientras el usuario
         * aún está completando el número (eso generaba errores continuos);
         * la consulta de un número diligenciado la lanza el propio usuario
         * con el botón de búsqueda (ver onBuscarOtroPernr).
         *
         * Caso especial: si el campo queda vacío (el usuario borró todo),
         * sí se revierte de inmediato aquí mismo, porque a diferencia de un
         * número a medio escribir, un campo vacío es un estado final e
         * inequívoco — no hay riesgo de consultar con datos incompletos.
         * No se usa el evento "change" (blur) para esto: como "value" tiene
         * binding bidireccional y este mismo liveChange escribe de vuelta al
         * modelo, el ciclo modelo→control en cada tecla hace que "change" no
         * llegue a dispararse al perder el foco (confirmado en pruebas).
         */
        onOtroPernrLiveChange(oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oEvent.getParameter("value") || "";
            var sSanitized = sValue.replace(/[^0-9]/g, "").slice(0, 8);

            if (sSanitized !== sValue) {
                oInput.setValue(sSanitized);
            }

            this.getView().getModel("viewiniView").setProperty("/otroPernr", sSanitized);

            if (!sSanitized) {
                this._recalcularTiposCertificado();
            }
        },

        /**
         * Maneja el press del botón de búsqueda junto a "Otro Numero de
         * personal": el usuario decide explícitamente cuándo ya terminó de
         * digitar el número y lanza la consulta de sus Tipos de Certificado.
         */
        onBuscarOtroPernr() {
            this._recalcularTiposCertificado();
        },

        /**
         * Recalcula la colección de Tipos de Certificado Laboral
         * (globalData>/tiposCertificado) y los datos de "Empleado"/"Nombre"
         * mostrados (globalData>/userData/d/Pernr y /Nombre) para el número
         * de personal diligenciado en "Otro Numero de personal": primero
         * consulta sus datos básicos (GetDataEmployee) para obtener su
         * correo electrónico y actualizar esos campos, y con ese correo
         * consulta los tipos de certificado disponibles (getTiposCertificado).
         * Si el campo está vacío, se vuelve a consultar con el correo del
         * usuario logueado, para que "Empleado"/"Nombre" vuelvan a mostrar
         * los datos del empleado original. No se toca
         * globalData>/userData/d/TienePermiso: ese permiso es del usuario
         * logueado, no del empleado consultado, y de él depende que el
         * campo "Otro Numero de personal" siga visible.
         * @private
         */
        _recalcularTiposCertificado() {
            var oGlobalDataModel = this.getOwnerComponent().getModel("globalData");
            var oViewiniModel = this.getView().getModel("viewiniView");
            var oView = this.getView();
            var that = this;

            // La lista/selección previa de Tipo de Certificado queda obsoleta
            // en cuanto cambia el número de personal a consultar.
            oViewiniModel.setProperty("/idCertificado", "");

            var sOtroPernr = (oViewiniModel.getProperty("/otroPernr") || "").trim();

            oView.setBusy(true);

            if (!sOtroPernr) {
                var sEmailLogueado = oGlobalDataModel.getProperty("/userLogin/email");

                this._oBackendService.GetDataEmployee(sEmailLogueado)
                    .then(function (oResponse) {
                        var oEmpleado = oResponse && oResponse.d;
                        if (oEmpleado) {
                            oGlobalDataModel.setProperty("/userData/d/Pernr", oEmpleado.Pernr);
                            oGlobalDataModel.setProperty("/userData/d/Nombre", oEmpleado.Nombre);
                        }
                    })
                    .catch(function (oError) {
                        console.error("Error al volver a consultar los datos del empleado logueado:", oError);
                    })
                    .then(function () {
                        return that._cargarTiposCertificadoPorCorreo(sEmailLogueado);
                    })
                    .then(function () {
                        oView.setBusy(false);
                    });
                return;
            }

            this._oBackendService.GetDataEmployee(sOtroPernr)
                .then(function (oResponse) {
                    var sCorreo = oResponse && oResponse.d && oResponse.d.Correo;

                    if (!sCorreo) {
                        console.warn("No se encontró el correo del empleado para el número de personal " + sOtroPernr);
                        oGlobalDataModel.setProperty("/tiposCertificado", []);
                        oView.setBusy(false);
                        return;
                    }

                    oGlobalDataModel.setProperty("/userData/d/Pernr", oResponse.d.Pernr);
                    oGlobalDataModel.setProperty("/userData/d/Nombre", oResponse.d.Nombre);

                    return that._cargarTiposCertificadoPorCorreo(sCorreo).then(function () {
                        oView.setBusy(false);
                    });
                })
                .catch(function (oError) {
                    oView.setBusy(false);
                    console.error("Error al consultar los datos del número de personal ingresado:", oError);
                    MessageBox.error("No fue posible consultar los datos del número de personal ingresado.");
                    oGlobalDataModel.setProperty("/tiposCertificado", []);
                });
        },

        /**
         * Consulta los Tipos de Certificado Laboral disponibles para un correo
         * electrónico y actualiza globalData>/tiposCertificado.
         * @param {string} sCorreo
         * @returns {Promise}
         * @private
         */
        _cargarTiposCertificadoPorCorreo(sCorreo) {
            var oGlobalDataModel = this.getOwnerComponent().getModel("globalData");

            return this._oBackendService.getTiposCertificado(sCorreo)
                .then(function (aTiposCertificado) {
                    oGlobalDataModel.setProperty("/tiposCertificado", aTiposCertificado);
                })
                .catch(function (oError) {
                    console.error("Error al consultar los tipos de certificado laboral:", oError);
                    MessageBox.error("No fue posible consultar los tipos de certificado laboral disponibles.");
                    oGlobalDataModel.setProperty("/tiposCertificado", []);
                });
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
            var sDescripcion = (oViewiniModel.getProperty("/descripcion") || "").trim();

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

            var sFecha = this._formatFechaAAAAMMDD(oFecha);
            var oView = this.getView();

            oView.setBusy(true);

            var oParams = {
                Pernr: sPernr,
                Fecha: sFecha,
                IdCertificado: sIdCertificado,
                TipoContrato: bTipoContrato,
                Salario: bSalario,
                Cargo: bCargo,
                Area: bArea
            };

            if (sDescripcion) {
                oParams.descripcion = sDescripcion;
            }

            this._oBackendService.generarCertificadoLaboral(oParams)
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
