sap.ui.define([
    "sap/ui/base/Object"
], function (BaseObject) {
    "use strict";

    return BaseObject.extend("ccb.org.certlaborales.service.BackendService", {

        // Servicio OData V2 ZHCM_CERTIFICADOS_PERSONAL_WD_SRV, expuesto a través
        // del destination "DestToSAP_QAS" (ruta mapeada en xs-app.json / ui5.yaml)
        _datosBasicosUrl: "/sap/opu/odata/sap/ZHCM_CERTIFICADOS_PERSONAL_WD_SRV/DatosBasicosCertLabSet",

        /**
         * Retorna la URL base de la app, respetando el subpath con el que fue
         * desplegada (html5-apps-repo / Work Zone), igual que en ccbvolantes.
         * @returns {string} URL base de la app
         * @private
         */
        _getAppBase: function () {
            return sap.ui.require.toUrl("ccb/org/certlaborales");
        },

        /**
         * Consulta los datos básicos / certificado laboral de un empleado por su correo electrónico
         * GET DatosBasicosCertLabSet('<email>')?$format=json
         * @param {string} sEmail - Correo electrónico del empleado (clave del servicio)
         * @returns {Promise} Promise que resuelve con el JSON de respuesta del servicio OData
         */
        GetDataEmployee: function (sEmail) {
            var sId = String(sEmail || "").trim().toUpperCase();
            var sUrl = this._getAppBase() + this._datosBasicosUrl + "('" + sId + "')";

            return this._executeGet(sUrl, { "$format": "json" });
        },

        /**
         * Ejecuta una petición GET al servicio OData con parámetros en la query string
         * @param {string} sUrl - URL base del servicio
         * @param {object} [oParams] - Parámetros a enviar en la query string (opcional)
         * @returns {Promise} Promise que resuelve con el JSON de respuesta
         * @private
         */
        _executeGet: function (sUrl, oParams) {
            return new Promise(function (resolve, reject) {
                var sQueryString = oParams ? Object.keys(oParams)
                    .map(function (sKey) {
                        return encodeURIComponent(sKey) + "=" + encodeURIComponent(oParams[sKey]);
                    })
                    .join("&") : "";

                var xhr = new XMLHttpRequest();
                xhr.open("GET", sQueryString ? (sUrl + "?" + sQueryString) : sUrl, true);
                xhr.setRequestHeader("Accept", "application/json");

                xhr.onload = function () {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
                        } catch (e) {
                            resolve({ data: xhr.responseText, rawResponse: true });
                        }
                    } else if (xhr.status === 401) {
                        reject({
                            error: "Authentication failed",
                            status: xhr.status,
                            statusText: xhr.statusText,
                            message: "El token de acceso es inválido o ha expirado"
                        });
                    } else {
                        reject({
                            error: "Service request failed",
                            status: xhr.status,
                            statusText: xhr.statusText,
                            response: xhr.responseText
                        });
                    }
                };

                xhr.onerror = function () {
                    reject({
                        error: "Network error",
                        status: xhr.status,
                        message: "Error de red al conectar con el servicio"
                    });
                };

                xhr.send();
            });
        }
    });
});
