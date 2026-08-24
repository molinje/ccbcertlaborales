sap.ui.define([
    "sap/ui/base/Object"
], function (BaseObject) {
    "use strict";

    return BaseObject.extend("ccb.org.certlaborales.service.BackendService", {

        // Servicio OData V2 ZHCM_CERTIFICADOS_PERSONAL_WD_SRV, expuesto a través
        // del destination "DestToSAP_QAS" (ruta mapeada en xs-app.json / ui5.yaml)
        _datosBasicosUrl: "/sap/opu/odata/sap/ZHCM_CERTIFICADOS_PERSONAL_WD_SRV/DatosBasicosCertLabSet",

        // Raíz del servicio, usada únicamente para obtener el token CSRF antes del POST
        _serviceRootUrl: "/sap/opu/odata/sap/ZHCM_CERTIFICADOS_PERSONAL_WD_SRV/",

        // Tipos de Certificado Laboral disponibles
        _tipoCertificadoUrl: "/sap/opu/odata/sap/ZHCM_CERTIFICADOS_PERSONAL_WD_SRV/TipoCertificadoLaboralSet",

        // Function Import que genera el PDF del Certificado Laboral
        _generarCertificadoUrl: "/sap/opu/odata/sap/ZHCM_CERTIFICADOS_PERSONAL_WD_SRV/GenerarCertificadoLaboral",

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
         * Consulta los tipos de Certificado Laboral disponibles para un correo electrónico
         * GET TipoCertificadoLaboralSet?$filter=Correo eq '<email>'&$format=json
         * @param {string} sEmail - Correo electrónico del empleado
         * @returns {Promise<Array<{Id: string, Descripcion: string}>>} Promise que resuelve con
         * una colección plana que contiene únicamente los campos Id y Descripcion de cada tipo
         */
        getTiposCertificado: function (sEmail) {
            var sId = String(sEmail || "").trim().toUpperCase();
            var sUrl = this._getAppBase() + this._tipoCertificadoUrl;
            var sFilter = "Correo eq '" + sId + "'";

            return this._executeGet(sUrl, { "$filter": sFilter, "$format": "json" })
                .then(function (oData) {
                    var aResults = (oData && oData.d && oData.d.results) || [];
                    return aResults.map(function (oItem) {
                        return {
                            Id: oItem.Id,
                            Descripcion: oItem.Descripcion
                        };
                    });
                });
        },

        /**
         * Obtiene el token CSRF requerido por el servicio OData antes de ejecutar
         * una operación de escritura (POST/Function Import). GET a la raíz del
         * servicio con el header "X-CSRF-Token: Fetch".
         * @returns {Promise<string>} Promise que resuelve con el valor del token CSRF
         * @private
         */
        _getCsrfToken: function () {
            var sUrl = this._getAppBase() + this._serviceRootUrl;

            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", sUrl, true);
                xhr.setRequestHeader("X-CSRF-Token", "Fetch");
                xhr.setRequestHeader("Accept", "application/json");

                xhr.onload = function () {
                    var sToken = xhr.getResponseHeader("X-CSRF-Token");
                    if (xhr.status >= 200 && xhr.status < 300 && sToken) {
                        resolve(sToken);
                    } else {
                        reject({
                            error: "No fue posible obtener el token CSRF",
                            status: xhr.status,
                            statusText: xhr.statusText
                        });
                    }
                };

                xhr.onerror = function () {
                    reject({
                        error: "Network error",
                        message: "Error de red al obtener el token CSRF"
                    });
                };

                xhr.send();
            });
        },

        /**
         * Genera el PDF del Certificado Laboral llamando al Function Import
         * GenerarCertificadoLaboral (POST). Primero obtiene el token CSRF requerido
         * por el servicio y luego ejecuta la generación con los parámetros indicados.
         * GET/POST GenerarCertificadoLaboral?Pernr='..'&Fecha='AAAAMMDD'&IdCertificado='..'
         *          &TipoContrato=true/false&Salario=true/false&Cargo=true/false&Area=true/false
         * @param {object} oParams - { Pernr, Fecha (AAAAMMDD), IdCertificado, TipoContrato, Salario, Cargo, Area }
         * @returns {Promise<Blob>} Promise que resuelve con el Blob del PDF generado
         */
        generarCertificadoLaboral: function (oParams) {
            var that = this;

            return this._getCsrfToken().then(function (sToken) {
                var sPernr = String((oParams && oParams.Pernr) || "").trim();
                var sFecha = String((oParams && oParams.Fecha) || "").trim();
                var sIdCertificado = String((oParams && oParams.IdCertificado) || "").trim();

                var aQueryParams = [
                    "Pernr=" + encodeURIComponent("'" + sPernr + "'"),
                    "Fecha=" + encodeURIComponent("'" + sFecha + "'"),
                    "IdCertificado=" + encodeURIComponent("'" + sIdCertificado + "'"),
                    "TipoContrato=" + (oParams && oParams.TipoContrato ? "true" : "false"),
                    "Salario=" + (oParams && oParams.Salario ? "true" : "false"),
                    "Cargo=" + (oParams && oParams.Cargo ? "true" : "false"),
                    "Area=" + (oParams && oParams.Area ? "true" : "false"),
                    "Estandar=false"
                ];

                var sUrl = that._getAppBase() + that._generarCertificadoUrl + "?" + aQueryParams.join("&");

                return that._executePostBinary(sUrl, sToken);
            });
        },

        /**
         * Ejecuta un POST al servicio OData (Function Import) y retorna el binario
         * de la respuesta (PDF) como Blob.
         * @param {string} sUrl - URL completa del Function Import, con parámetros incluidos
         * @param {string} sCsrfToken - Token CSRF obtenido previamente con _getCsrfToken
         * @returns {Promise<Blob>} Promise que resuelve con el Blob de la respuesta
         * @private
         */
        _executePostBinary: function (sUrl, sCsrfToken) {
            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open("POST", sUrl, true);
                xhr.responseType = "blob";
                xhr.setRequestHeader("X-CSRF-Token", sCsrfToken);
                xhr.setRequestHeader("Accept", "application/pdf, application/json");

                xhr.onload = function () {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        var sContentType = xhr.getResponseHeader("Content-Type") || "";

                        if (sContentType.indexOf("application/json") !== -1) {
                            // El servicio respondió JSON (p.ej. un mensaje de error controlado)
                            var oReader = new FileReader();
                            oReader.onload = function () {
                                try {
                                    reject(JSON.parse(oReader.result));
                                } catch (e) {
                                    reject({ error: "Respuesta inesperada del servicio", raw: oReader.result });
                                }
                            };
                            oReader.onerror = function () {
                                reject({ error: "No fue posible leer la respuesta del servicio" });
                            };
                            oReader.readAsText(xhr.response);
                            return;
                        }

                        resolve(xhr.response);
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
                            statusText: xhr.statusText
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
