var CambaiTranslator = function(exports) {
    "use strict";
    const API_ENDPOINTS = {
      CONFIG: "/translate/config",
      TEXT_BASED: "/translate/text-based",
      CHECK_EDIT_PERMISSION: "/translate/cache/check-edit-permission",
      CACHE_UPDATE_ON_PAGE: "/translate/cache/update-on-page"
    };
    const SELECTORS = {
      ERROR_MESSAGE: "tl-error-message",
      DROPDOWN_CONTAINER: "tl-dropdown-container",
      DROPDOWN_STYLE: "tl-dropdown-style",
      DROPDOWN: "tl-dropdown",
      POWERED_BY: "tl-powered-by"
    };
    const ATTRIBUTES = {
      NO_TRANSLATE: "data-no-translate",
      TRANSLATED_TO: "data-tl-to",
      SOURCE_TEXT: "data-tl-src",
      SOURCE_ATTRIBUTE_PREFIX: "data-tl-src-",
      TRANSLATION_STATE: "data-tl-state"
    };
    const TRANSLATABLE_ATTRIBUTES = [
      "title",
      "alt",
      "placeholder",
      "value",
      "aria-label",
      "aria-description",
      "data-tooltip",
      "data-tip",
      "data-original-title",
      "data-hover",
      "data-after-content"
    ];
    const TIMINGS = {
      ERROR_MESSAGE_DURATION: 5e3,
      SPA_NAVIGATION_DEBOUNCE: 150,
      DYNAMIC_TRANSLATION_DEBOUNCE: 100
      // ms
    };
    const LOCAL_STORAGE_KEYS = {
      DROPDOWN_POSITION: "tl-dropdown-position",
      SELECTED_LANGUAGE: "tl-selected-language",
      SOURCE_CACHE: "tl-source-cache"
    };
    const DROPDOWN_EXCLUDED_SELECTORS = [
      "[data-no-translate]",
      '[data-translated="true"]',
      ".notranslate",
      '[translate="no"]',
      "script",
      "style",
      "noscript"
    ];
    const EXCLUDED_RTL_SELECTORS = ["[data-no-rtl]", '[data-rtl="false"]', ".noRtl", ".no-rtl"];
    const CACHE_EDITOR_SELECTORS = {
      POPOVER: "ce-popover",
      POPOVER_STYLE: "ce-popover-style",
      EDIT_PILL: "tl-edit-pill",
      EDIT_PILL_STYLE: "tl-edit-pill-style"
    };
    const CACHE_EDITOR_TIMINGS = {
      HOVER_DEBOUNCE: 50
    };
    const EDIT_PILL_LAYOUT = {
      GAP: 8,
      VIEWPORT_MARGIN: 8
    };
    const HARD_CODED_RTL = /* @__PURE__ */ new Set([
      "ar",
      // Arabic
      "he",
      // Hebrew
      "fa",
      // Persian
      "ur",
      // Urdu
      "ps",
      // Pashto
      "sd",
      // Sindhi
      "ug",
      // Uyghur
      "yi"
      // Yiddish
    ]);
    function isRtl(lang) {
      const base = lang.split("-")[0].toLowerCase();
      if (HARD_CODED_RTL.has(base)) return true;
      try {
        const script = new Intl.Locale(lang).maximize().script;
        return script === "Arab" || script === "Hebr";
      } catch {
        return false;
      }
    }
    function applyDirection(lang) {
      const direction = isRtl(lang) ? "rtl" : "ltr";
      document.documentElement.dir = direction;
      document.documentElement.lang = lang;
      if (document.body) {
        document.body.dir = direction;
        document.body.lang = lang;
      } else {
        document.addEventListener(
          "DOMContentLoaded",
          () => {
            if (document.body) {
              document.body.dir = direction;
              document.body.lang = lang;
            }
          },
          { once: true }
        );
      }
      const styleElementId = "translator-rtl-overrides";
      if (!document.getElementById(styleElementId)) {
        const style = document.createElement("style");
        style.id = styleElementId;
        style.type = "text/css";
        const selectorList = Array.from(EXCLUDED_RTL_SELECTORS).join(", ");
        style.textContent = `${selectorList} { direction: ltr !important; unicode-bidi: isolate !important; }`;
        document.head.appendChild(style);
      }
      const bodyEnforcerId = "translator-body-direction-enforcer";
      const existingEnforcer = document.getElementById(bodyEnforcerId);
      if (direction === "ltr") {
        if (!existingEnforcer) {
          const style = document.createElement("style");
          style.id = bodyEnforcerId;
          style.type = "text/css";
          style.textContent = `body { direction: ltr !important; }`;
          document.head.appendChild(style);
        } else {
          existingEnforcer.textContent = `body { direction: ltr !important; }`;
        }
      } else if (existingEnforcer) {
        existingEnforcer.remove();
      }
    }
    class ErrorHandler {
      static showErrorMessage(type, details, retryCallback) {
        const existing = document.getElementById(SELECTORS.ERROR_MESSAGE);
        if (existing) existing.remove();
        const errorDiv = document.createElement("div");
        errorDiv.id = SELECTORS.ERROR_MESSAGE;
        errorDiv.setAttribute("data-no-translate", "true");
        const errorDetail = this.getErrorDetail(type, details);
        console.error(`Translation Error [${type}]:`, errorDetail.message, details);
        const errorContent = document.createElement("div");
        errorContent.style.cssText = "display: flex; flex-direction: column; gap: 8px;";
        const messageDiv = document.createElement("div");
        messageDiv.textContent = errorDetail.message;
        errorContent.appendChild(messageDiv);
        if (errorDetail.retryable && retryCallback) {
          const retryButton = document.createElement("button");
          retryButton.textContent = "Retry";
          retryButton.style.cssText = `
                  background: white; color: #dc2626; border: none;
                  padding: 4px 12px; border-radius: 4px; cursor: pointer;
                  font-size: 12px; font-weight: 500; margin-top: 4px;
              `;
          retryButton.onclick = () => {
            errorDiv.remove();
            retryCallback();
          };
          errorContent.appendChild(retryButton);
        }
        errorDiv.style.cssText = `
              position: fixed; bottom: 24px; right: 24px; z-index: 9999;
              background: #dc2626; color: white; padding: 12px 16px;
              border-radius: 8px; font: 14px/1.4 sans-serif;
              max-width: 320px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          `;
        errorDiv.appendChild(errorContent);
        document.body.appendChild(errorDiv);
        const duration = errorDetail.showDuration || TIMINGS.ERROR_MESSAGE_DURATION;
        setTimeout(() => {
          if (errorDiv.parentNode) {
            errorDiv.remove();
          }
        }, duration);
      }
      static getErrorDetail(type, customMessage) {
        const errorMap = {
          auth: {
            type: "auth",
            message: customMessage || "🔒 Authentication failed. Please check your API key.",
            retryable: false,
            showDuration: 8e3
          },
          server: {
            type: "server",
            message: customMessage || "⚠️ Translation service temporarily unavailable. Please try again later.",
            retryable: true,
            showDuration: 8e3
          },
          network: {
            type: "network",
            message: customMessage || "🌐 Connection failed. Please check your internet connection.",
            retryable: true,
            showDuration: 8e3
          },
          "rate-limit": {
            type: "rate-limit",
            message: customMessage || "⏳ Too many requests. Please try again later.",
            fallback: "Using cached translations where available.",
            retryable: true,
            showDuration: 1e4
          },
          "unsupported-language": {
            type: "unsupported-language",
            message: customMessage || "🌍 Language not supported. Using default language.",
            retryable: false,
            showDuration: 6e3
          },
          "invalid-url": {
            type: "invalid-url",
            message: customMessage || "❌ Invalid URL format. Please check the URL and try again.",
            retryable: false,
            showDuration: 8e3
          },
          "cache-unavailable": {
            type: "cache-unavailable",
            message: customMessage || "💾 Cache unavailable. Using direct translation service.",
            fallback: "Translations may be slower than usual.",
            retryable: false,
            showDuration: 6e3
          },
          "config-invalid": {
            type: "config-invalid",
            message: customMessage || "⚙️ Invalid configuration. Please contact support.",
            retryable: false,
            showDuration: 1e4
          },
          offline: {
            type: "offline",
            message: customMessage || "📡 You are offline. Using cached translations where available.",
            fallback: "New translations unavailable until connection restored.",
            retryable: true,
            showDuration: 6e3
          }
        };
        return errorMap[type] || errorMap["server"];
      }
      static clearError() {
        const existing = document.getElementById(SELECTORS.ERROR_MESSAGE);
        if (existing) existing.remove();
      }
      static isOffline() {
        return !navigator.onLine;
      }
    }
    async function parseHttpErrorMessage(response, fallback) {
      const defaultMessage = fallback ?? `Request failed (${response.status})`;
      const data = await response.json().catch(() => null);
      if (!data || typeof data !== "object") return defaultMessage;
      const detail = data.detail;
      if (typeof detail === "string" && detail.trim()) {
        return detail.trim();
      }
      if (Array.isArray(detail)) {
        const parts = detail.map((item) => {
          if (!item || typeof item !== "object") return "";
          const msg = item.msg ?? item.message;
          return typeof msg === "string" ? msg.trim() : "";
        }).filter(Boolean);
        if (parts.length) return parts.join(" ");
      }
      if (detail && typeof detail === "object") {
        const message = detail.message;
        if (typeof message === "string" && message.trim()) return message.trim();
      }
      const topLevelMessage = data.message;
      if (typeof topLevelMessage === "string" && topLevelMessage.trim()) {
        return topLevelMessage.trim();
      }
      return defaultMessage;
    }
    function snakeToCamelString(str) {
      return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    }
    function camelToSnakeString(str) {
      return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    }
    function snakeToCamelObject(obj) {
      return Object.fromEntries(Object.entries(obj).map(([key, value]) => [snakeToCamelString(key), value]));
    }
    function camelToSnakeObject(obj) {
      return Object.fromEntries(Object.entries(obj).map(([key, value]) => [camelToSnakeString(key), value]));
    }
    class ApiService {
      constructor(apiConfig, onCriticalError) {
        this.maxRetries = 3;
        this.configApiUrl = (apiConfig == null ? void 0 : apiConfig.configApiUrl) || "https://dev-website-translator.camb.ai";
        this.onCriticalError = onCriticalError;
      }
      getConfigApiUrl() {
        return this.configApiUrl;
      }
      setCriticalErrorHandler(handler) {
        this.onCriticalError = handler;
      }
      getConfigTextBasedUrl() {
        return `${this.configApiUrl}${API_ENDPOINTS.TEXT_BASED}`;
      }
      getTextBasedUrl(apiConfig) {
        return (apiConfig == null ? void 0 : apiConfig.translateApiUrl) ?? this.getConfigTextBasedUrl();
      }
      usesWorkerTranslate(apiConfig) {
        return Boolean(apiConfig == null ? void 0 : apiConfig.translateApiUrl);
      }
      async checkRedisAvailability({
        textNodes = ["__health__"],
        translateConfig,
        apiConfig,
        pageContext,
        abortSignal
      }) {
        try {
          const response = await fetch(this.getConfigTextBasedUrl(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: `Bearer ${apiConfig.key}`,
              "X-Domain": apiConfig.domain
            },
            body: JSON.stringify(
              camelToSnakeObject({ textNodes, translateConfig, dropdownLabels: [], pageContext })
            ),
            signal: abortSignal
          });
          if (!response.ok) {
            await this.handleTranslationError(response);
            return false;
          }
          const data = await response.json();
          if (data && data.redis_available === false) {
            return false;
          }
          return true;
        } catch (error) {
          if (error instanceof Error && (error.message === "REDIS_UNAVAILABLE" || error.message === "RATE_LIMIT")) {
            return false;
          }
          throw error;
        }
      }
      async fetchConfig(apiKey, domain) {
        try {
          if (!apiKey || !domain) {
            ErrorHandler.showErrorMessage("config-invalid", "Invalid configuration: Missing API key or domain.");
            throw new Error("INVALID_CONFIG");
          }
          try {
            new URL(this.configApiUrl);
          } catch {
            ErrorHandler.showErrorMessage("invalid-url", "Invalid API URL format.");
            throw new Error("INVALID_URL");
          }
          const response = await fetch(`${this.configApiUrl}${API_ENDPOINTS.CONFIG}`, {
            method: "GET",
            credentials: "omit",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Origin: window.location.origin,
              "Content-Type": "application/json"
            }
          });
          if (!response.ok) {
            await this.handleConfigError(response);
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const config = await response.json();
          const payload = config.payload || config;
          if (!payload.default_language) {
            ErrorHandler.showErrorMessage("config-invalid", "Invalid configuration: Missing default language.");
            throw new Error("INVALID_CONFIG");
          }
          if (!payload.selected_languages) {
            ErrorHandler.showErrorMessage(
              "config-invalid",
              "Invalid configuration: No target languages specified."
            );
            throw new Error("INVALID_CONFIG");
          }
          return {
            domain,
            defaultLang: payload.default_language,
            languageLabels: payload.language_labels,
            targetLanguages: payload.selected_languages,
            websiteId: payload.website_id,
            teamId: payload.team_id,
            seoConfiguration: payload.seo_configuration ?? null
          };
        } catch (e) {
          console.error("❌ Failed to fetch configuration:", e);
          if (e instanceof TypeError && e.message.includes("Failed to fetch")) {
            if (ErrorHandler.isOffline()) {
              ErrorHandler.showErrorMessage("offline", "Cannot load translation configuration while offline.");
            } else {
              ErrorHandler.showErrorMessage(
                "network",
                "Failed to load translation configuration. Please check your connection."
              );
            }
            throw new Error("NETWORK_ERROR");
          }
          if (e instanceof Error && e.message === "RATE_LIMIT") {
            throw e;
          }
          throw e;
        }
      }
      async handleConfigError(response) {
        var _a, _b;
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          ErrorHandler.showErrorMessage(
            "auth",
            errorData.error === "invalid_api_key" ? "Invalid API key" : void 0
          );
        } else if (response.status === 403) {
          ErrorHandler.showErrorMessage(
            "auth",
            errorData.error === "origin_not_allowed" ? "Domain not authorized for this API key" : void 0
          );
        } else if (response.status === 404) {
          ErrorHandler.showErrorMessage(
            "server",
            ((_a = errorData == null ? void 0 : errorData.detail) == null ? void 0 : _a.error) === "website_not_found" ? errorData.detail.message : "Translation configuration not found."
          );
        } else if (response.status === 429) {
          ErrorHandler.showErrorMessage(
            "rate-limit",
            errorData.message || "You're sending requests too quickly. Please wait and try again."
          );
          throw new Error("RATE_LIMIT");
        } else if (response.status >= 500) {
          if (errorData.detail && errorData.detail.includes("Redis connection failed")) {
            ErrorHandler.showErrorMessage("server", "Translation service unavailable (Redis connection failed)");
            (_b = this.onCriticalError) == null ? void 0 : _b.call(this);
          } else {
            ErrorHandler.showErrorMessage("server");
          }
        } else {
          ErrorHandler.showErrorMessage("network", `HTTP ${response.status}`);
        }
      }
      async translateTextBased({
        textNodes,
        translateConfig,
        apiConfig,
        dropdownLabels,
        pageContext,
        abortSignal
      }) {
        if (ErrorHandler.isOffline()) {
          ErrorHandler.showErrorMessage(
            "offline",
            "You are currently offline. Using cached translations where available."
          );
        }
        const makeRequest = async (retryAttempt = 0) => {
          try {
            const workerTranslate = this.usesWorkerTranslate(apiConfig);
            const headers = {
              "Content-Type": "application/json",
              Accept: "application/json"
            };
            if (!workerTranslate) {
              headers.Authorization = `Bearer ${apiConfig.key}`;
              headers["X-Domain"] = apiConfig.domain;
            }
            const response = await fetch(this.getTextBasedUrl(apiConfig), {
              method: "POST",
              headers,
              body: JSON.stringify(
                camelToSnakeObject({ textNodes, translateConfig, dropdownLabels, pageContext })
              ),
              signal: abortSignal
            });
            if (!response.ok) {
              await this.handleTranslationError(response);
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.redis_available === false) {
              ErrorHandler.showErrorMessage(
                "cache-unavailable",
                "Cache service temporarily unavailable. Translations may be slower. Please refresh the browser."
              );
            }
            const responseBody = snakeToCamelObject(data);
            if (!Array.isArray(responseBody.translatedTextNodes) || responseBody.translatedTextNodes.length !== textNodes.length || !responseBody.translatedTextNodes.every((text) => typeof text === "string")) {
              throw new Error("INVALID_TRANSLATION_RESPONSE");
            }
            return responseBody;
          } catch (error) {
            if (ApiService.isAbortError(error)) {
              throw error;
            }
            if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
              if (retryAttempt < this.maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryAttempt) * 1e3));
                return makeRequest(retryAttempt + 1);
              }
              if (ErrorHandler.isOffline()) {
                ErrorHandler.showErrorMessage("offline");
              } else {
                ErrorHandler.showErrorMessage(
                  "network",
                  "Network connection failed. Please check your connection."
                );
              }
              throw new Error("NETWORK_ERROR");
            }
            if (error instanceof Error && error.message === "RATE_LIMIT") {
              if (retryAttempt < 2) {
                await new Promise((resolve) => setTimeout(resolve, 5e3 * (retryAttempt + 1)));
                return makeRequest(retryAttempt + 1);
              }
            }
            throw error;
          }
        };
        return makeRequest();
      }
      async handleTranslationError(response) {
        const errorData = await response.json().catch(() => ({}));
        const errorDetail = errorData.detail || {};
        const errorType = errorDetail.error || "unknown";
        let errorCode = `HTTP_${response.status}`;
        switch (errorType) {
          case "unsupported_language":
            ErrorHandler.showErrorMessage("unsupported-language", errorDetail.message);
            errorCode = "UNSUPPORTED_LANGUAGE";
            break;
          case "rate_limit":
            const retryMsg = errorDetail.from_cache_only ? "Rate limit reached. Serving cached translations." : "Too many requests. Please try again later.";
            ErrorHandler.showErrorMessage("rate-limit", retryMsg);
            errorCode = "RATE_LIMIT";
            break;
          case "invalid_api_key":
            ErrorHandler.showErrorMessage("auth", "Invalid API key. Please check your configuration.");
            errorCode = "UNAUTHORIZED";
            break;
          case "domain_mismatch":
          case "origin_not_allowed":
            ErrorHandler.showErrorMessage("auth", "This domain is not authorized for the provided API key.");
            errorCode = "FORBIDDEN";
            break;
          default:
            if (response.status === 401) {
              ErrorHandler.showErrorMessage("auth", errorDetail.message || "Authentication failed");
              errorCode = "UNAUTHORIZED";
            } else if (response.status === 403) {
              ErrorHandler.showErrorMessage("auth", errorDetail.message || "Access forbidden");
              errorCode = "FORBIDDEN";
            } else if (response.status === 404) {
              ErrorHandler.showErrorMessage(
                "server",
                errorData.error === "website_not_found" ? "Translation configuration not found." : void 0
              );
            } else if (response.status === 429) {
              ErrorHandler.showErrorMessage(
                "rate-limit",
                errorDetail.message || "You’re sending requests too quickly. Please wait a moment and try again."
              );
              errorCode = "RATE_LIMIT";
            } else if (response.status >= 500) {
              if (errorDetail.message && errorDetail.message.includes("Redis")) {
                ErrorHandler.showErrorMessage(
                  "server",
                  "Translation service experiencing issues. Some features may be limited."
                );
                errorCode = "REDIS_UNAVAILABLE";
              } else {
                ErrorHandler.showErrorMessage("server", errorDetail.message || "Server error");
                errorCode = "SERVER_ERROR";
              }
            } else {
              ErrorHandler.showErrorMessage(
                "network",
                `HTTP ${response.status}: ${errorDetail.message || "Unknown error"}`
              );
              errorCode = "NETWORK_ERROR";
            }
        }
        throw new Error(errorCode);
      }
      static isAbortError(error) {
        return error.name === "AbortError";
      }
      /** Legacy translate path sends dropdown labels with page text; SEO pages call this alone. */
      async fetchTranslatedDropdownLabels({
        translateConfig,
        apiConfig,
        dropdownLabels,
        pageContext,
        abortSignal
      }) {
        const workerTranslate = this.usesWorkerTranslate(apiConfig);
        const headers = {
          "Content-Type": "application/json",
          Accept: "application/json"
        };
        if (!workerTranslate) {
          headers.Authorization = `Bearer ${apiConfig.key}`;
          headers["X-Domain"] = apiConfig.domain;
        }
        const response = await fetch(this.getTextBasedUrl(apiConfig), {
          method: "POST",
          headers,
          body: JSON.stringify(
            camelToSnakeObject({
              textNodes: [],
              translateConfig,
              dropdownLabels,
              pageContext
            })
          ),
          signal: abortSignal
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.translated_dropdown_labels ?? [];
      }
      async shouldEnableEditSession(apiConfig) {
        try {
          const response = await fetch(`${this.configApiUrl}${API_ENDPOINTS.CHECK_EDIT_PERMISSION}`, {
            method: "GET",
            credentials: "include",
            headers: {
              Authorization: `Bearer ${apiConfig.key}`,
              Origin: typeof window !== "undefined" ? window.location.origin : "",
              "Content-Type": "application/json"
            }
          });
          if (!response.ok) {
            return false;
          }
          const data = await response.json();
          return (data == null ? void 0 : data.can_edit) === true;
        } catch {
          return false;
        }
      }
      async updateTranslationCache(params) {
        const response = await fetch(`${this.configApiUrl}${API_ENDPOINTS.CACHE_UPDATE_ON_PAGE}`, {
          method: "PUT",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${params.apiConfig.key}`,
            Origin: typeof window !== "undefined" ? window.location.origin : "",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            source_text: params.sourceText,
            target_lang: params.targetLang,
            value: params.value
          })
        });
        if (!response.ok) {
          const message = await parseHttpErrorMessage(
            response,
            "Failed to save translation. Please try again."
          );
          throw new Error(message);
        }
      }
    }
    class StorageManager {
      static saveDropdownPosition(position) {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEYS.DROPDOWN_POSITION, JSON.stringify(position));
        } catch (e) {
          console.warn("Failed to save dropdown position to localStorage:", e);
        }
      }
      static loadDropdownPosition() {
        try {
          const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.DROPDOWN_POSITION);
          if (saved) {
            const position = JSON.parse(saved);
            if (typeof position.x === "number" && typeof position.y === "number") {
              return position;
            }
          }
        } catch (e) {
          console.warn("Failed to load dropdown position from localStorage:", e);
        }
        return null;
      }
      static saveSelectedLanguage(lang) {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEYS.SELECTED_LANGUAGE, lang);
        } catch (e) {
          console.warn("Failed to save selected language to localStorage:", e);
        }
      }
      static loadSelectedLanguage() {
        try {
          let value = localStorage.getItem(LOCAL_STORAGE_KEYS.SELECTED_LANGUAGE);
          if (value && value[0] === '"' && value[value.length - 1] === '"') {
            value = value.slice(1, -1);
          }
          return value;
        } catch (e) {
          console.warn("Failed to load selected language from localStorage:", e);
          return null;
        }
      }
      static clearSelectedLanguage() {
        try {
          localStorage.removeItem(LOCAL_STORAGE_KEYS.SELECTED_LANGUAGE);
        } catch (e) {
          console.warn("Failed to clear selected language from localStorage:", e);
        }
      }
    }
    class DomUtils {
      static getCurrentPath() {
        return window.location.pathname + window.location.search;
      }
      static getScriptConfig() {
        const tag = document.currentScript;
        const rawDomain = (tag == null ? void 0 : tag.dataset.domain) || window.location.host;
        const domain = DomUtils.normalizeDomain(rawDomain);
        const apiKey = (tag == null ? void 0 : tag.dataset.apiKey) || "";
        return { apiKey, domain };
      }
      static normalizeDomain(inputDomain) {
        if (!inputDomain) return "";
        let domain = inputDomain.trim().toLowerCase();
        domain = domain.replace(/^(https?:\/\/)/, "");
        if (domain.startsWith("www.")) {
          domain = domain.slice(4);
        }
        domain = domain.split("/")[0];
        return domain;
      }
      static shouldPreventTranslation(element) {
        if (!element) return false;
        let current = element;
        while (current) {
          if (current.getAttribute("translate") === "no") {
            return true;
          }
          if (current.classList && current.classList.contains("notranslate")) {
            return true;
          }
          if (current.hasAttribute("data-no-translate")) {
            return true;
          }
          current = current.parentElement;
        }
        return false;
      }
      static isNonContentElement(element) {
        const tagName = element.tagName;
        return tagName === "SCRIPT" || tagName === "STYLE" || tagName === "NOSCRIPT";
      }
      static escapeHtml(str) {
        const htmlEscapes = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#x27;",
          "/": "&#x2F;"
        };
        return str.replace(/[&<>"'/]/g, (char) => htmlEscapes[char] || char);
      }
      static detectCSPViolations() {
        try {
          const testStyle = document.createElement("style");
          testStyle.textContent = ".csp-test { display: none; }";
          document.head.appendChild(testStyle);
          document.head.removeChild(testStyle);
        } catch (e) {
          console.warn("⚠️ CSP may block inline styles needed for translation dropdown");
        }
        document.addEventListener("securitypolicyviolation", (e) => {
          if (e.violatedDirective.includes("script-src") || e.violatedDirective.includes("style-src") || e.violatedDirective.includes("connect-src")) {
            console.warn(`⚠️ CSP violation detected: ${e.violatedDirective} - Translation features may be limited`);
          }
        });
      }
      static getBrowserLanguage() {
        if (navigator.language) {
          return navigator.language.split("-")[0].toLowerCase();
        }
        if (navigator.languages && navigator.languages.length > 0) {
          return navigator.languages[0].split("-")[0].toLowerCase();
        }
        return null;
      }
      static updateCanonicalUrl(targetLang, sourceLang) {
        const canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) return;
        try {
          const url = new URL(canonical.href);
          if (targetLang !== sourceLang) {
            url.searchParams.set("lang", targetLang);
          } else {
            url.searchParams.delete("lang");
          }
          canonical.href = url.toString();
        } catch (e) {
          console.warn("Failed to update canonical URL:", e);
        }
      }
    }
    function waitForDomToSettle(root, quietMs = 250, maxWaitMs = 1e3) {
      return new Promise((resolve) => {
        let timer;
        const obs = new MutationObserver(() => {
          clearTimeout(timer);
          timer = window.setTimeout(done, quietMs);
        });
        function done() {
          obs.disconnect();
          resolve();
        }
        obs.observe(root, { childList: true, subtree: true, characterData: true });
        const hardStop = window.setTimeout(() => {
          obs.disconnect();
          resolve();
        }, maxWaitMs);
        timer = window.setTimeout(() => {
          clearTimeout(hardStop);
          done();
        }, quietMs);
      });
    }
    function normalizeHost(host) {
      var _a;
      const lower = ((_a = host.trim().toLowerCase().split(":")[0]) == null ? void 0 : _a.split("/")[0]) ?? "";
      return lower.startsWith("www.") ? lower.slice(4) : lower;
    }
    function firstPathSegment(pathname) {
      const match = pathname.match(/^\/([^/?#]+)/);
      return match == null ? void 0 : match[1];
    }
    function isActive(status) {
      return status === "active";
    }
    function subdomainRouteIsRoutable(route, defaultLang) {
      return isActive(route.status) && route.locale !== defaultLang;
    }
    function subdirectoryDomainIsRoutable(domain) {
      return isActive(domain.status);
    }
    function subdirectoryRouteIsRoutable(route, defaultLang) {
      return route.locale !== defaultLang;
    }
    function isDomainRequestHost(requestHost, domain) {
      const host = normalizeHost(requestHost);
      const base = normalizeHost(domain);
      return Boolean(host && base && (host === base || host === `www.${base}`));
    }
    function hostnameMatchesSeoConfiguration(hostname, seoConfiguration) {
      var _a;
      if (!((_a = seoConfiguration == null ? void 0 : seoConfiguration.domains) == null ? void 0 : _a.length)) {
        return false;
      }
      const host = normalizeHost(hostname);
      if (!host) {
        return false;
      }
      for (const domainEntry of seoConfiguration.domains) {
        const base = normalizeHost(domainEntry.domain);
        if (!base) {
          continue;
        }
        if (host === base || host === `www.${base}`) {
          return true;
        }
        if (domainEntry.routing_mode === "subdomain") {
          for (const route of domainEntry.routes) {
            if (host === `${route.slug.toLowerCase()}.${base}`) {
              return true;
            }
          }
        }
      }
      return false;
    }
    function isLocalDevHost(hostname) {
      const host = normalizeHost(hostname);
      return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
    }
    function hasActiveSeoConfiguration(seoConfiguration) {
      var _a;
      if (!((_a = seoConfiguration == null ? void 0 : seoConfiguration.domains) == null ? void 0 : _a.length)) {
        return false;
      }
      return seoConfiguration.domains.some((domain) => {
        if (domain.routing_mode === "subdomain") {
          return domain.routes.some((route) => isActive(route.status));
        }
        return subdirectoryDomainIsRoutable(domain) && domain.routes.length > 0;
      });
    }
    function parseSubdomainLanguage(requestHost, seoConfiguration, defaultLang) {
      const hostname = normalizeHost(requestHost);
      if (!hostname || hostname.startsWith("www.")) {
        return { mode: "source" };
      }
      for (const domain of seoConfiguration.domains) {
        if (domain.routing_mode !== "subdomain") {
          continue;
        }
        const baseDomain = normalizeHost(domain.domain);
        if (!baseDomain) {
          continue;
        }
        for (const route of domain.routes) {
          if (!subdomainRouteIsRoutable(route, defaultLang)) {
            continue;
          }
          const expectedHost = `${route.slug.toLowerCase()}.${baseDomain}`;
          if (hostname === expectedHost) {
            return {
              mode: "subdomain",
              pageLang: route.locale,
              slug: route.slug,
              matchedDomain: domain,
              matchedRoute: route
            };
          }
        }
      }
      return { mode: "source" };
    }
    function parseSubdirectoryLanguage(pathname, requestHost, seoConfiguration, defaultLang) {
      const segment = firstPathSegment(pathname);
      if (!segment) {
        return { mode: "source" };
      }
      for (const domain of seoConfiguration.domains) {
        if (domain.routing_mode !== "subdirectory" || !subdirectoryDomainIsRoutable(domain)) {
          continue;
        }
        if (!isDomainRequestHost(requestHost, domain.domain)) {
          continue;
        }
        const route = domain.routes.find((entry) => entry.slug === segment);
        if (!route || !subdirectoryRouteIsRoutable(route, defaultLang)) {
          continue;
        }
        return {
          mode: "subdirectory",
          pageLang: route.locale,
          slug: route.slug,
          matchedDomain: domain,
          matchedRoute: route
        };
      }
      return { mode: "source" };
    }
    function resolveSeoContext(args) {
      var _a, _b;
      if (isLocalDevHost(args.hostname) || !((_b = (_a = args.seoConfiguration) == null ? void 0 : _a.domains) == null ? void 0 : _b.length)) {
        return { mode: "source" };
      }
      const subdomain = parseSubdomainLanguage(args.hostname, args.seoConfiguration, args.defaultLang);
      if (subdomain.mode === "subdomain") {
        return subdomain;
      }
      return parseSubdirectoryLanguage(args.pathname, args.hostname, args.seoConfiguration, args.defaultLang);
    }
    function stripSubdirectoryPrefix(pathname, slug) {
      if (!slug) {
        return pathname || "/";
      }
      const prefix = `/${slug}`;
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        const remainder = pathname.slice(prefix.length);
        return remainder.length > 0 ? remainder : "/";
      }
      return pathname || "/";
    }
    function findRouteForLocaleInDomain(domain, locale) {
      if (domain.routing_mode === "subdirectory" && !subdirectoryDomainIsRoutable(domain)) {
        return null;
      }
      for (const route of domain.routes) {
        if (route.locale !== locale) {
          continue;
        }
        if (domain.routing_mode === "subdomain" && !isActive(route.status)) {
          continue;
        }
        return { domain, route };
      }
      return null;
    }
    function findRouteForLocale(seoConfiguration, locale) {
      for (const domain of seoConfiguration.domains) {
        const match = findRouteForLocaleInDomain(domain, locale);
        if (match) {
          return match;
        }
      }
      return null;
    }
    function buildLanguageUrl(args) {
      if (!hasActiveSeoConfiguration(args.seoConfiguration)) {
        return null;
      }
      const currentContext = resolveSeoContext({
        seoConfiguration: args.seoConfiguration,
        defaultLang: args.defaultLang,
        hostname: args.currentUrl.hostname,
        pathname: args.currentUrl.pathname
      });
      const originPath = currentContext.mode === "subdirectory" ? stripSubdirectoryPrefix(args.currentUrl.pathname, currentContext.slug) : args.currentUrl.pathname;
      if (args.targetLocale === args.defaultLang) {
        const url2 = new URL(originPath + args.currentUrl.search + args.currentUrl.hash, args.currentUrl.origin);
        if (currentContext.mode === "subdomain" && currentContext.matchedDomain) {
          url2.hostname = currentContext.matchedDomain.domain;
        }
        return url2.toString();
      }
      const match = (currentContext.matchedDomain ? findRouteForLocaleInDomain(currentContext.matchedDomain, args.targetLocale) : null) ?? findRouteForLocale(args.seoConfiguration, args.targetLocale);
      if (!match) {
        return null;
      }
      const { domain, route } = match;
      if (domain.routing_mode === "subdomain") {
        const baseDomain = normalizeHost(domain.domain);
        const url2 = new URL(originPath + args.currentUrl.search + args.currentUrl.hash, args.currentUrl.origin);
        url2.hostname = `${route.slug.toLowerCase()}.${baseDomain}`;
        return url2.toString();
      }
      const prefixedPath = originPath === "/" ? `/${route.slug}` : `/${route.slug}${originPath}`;
      const url = new URL(prefixedPath + args.currentUrl.search + args.currentUrl.hash, args.currentUrl.origin);
      url.hostname = normalizeHost(domain.domain);
      return url.toString();
    }
    function resolveEmbedRoutingMode(seoConfiguration) {
      if (!hasActiveSeoConfiguration(seoConfiguration)) {
        return "legacy";
      }
      const activeDomain = seoConfiguration.domains.find((domain) => {
        if (domain.routing_mode === "subdomain") {
          return domain.routes.some((route) => isActive(route.status));
        }
        return subdirectoryDomainIsRoutable(domain) && domain.routes.length > 0;
      });
      if (!activeDomain) {
        return "legacy";
      }
      return activeDomain.routing_mode === "subdirectory" ? "subdirectory-seo" : "subdomain-seo";
    }
    function usesSeoRouting(seoConfiguration) {
      return resolveEmbedRoutingMode(seoConfiguration) !== "legacy";
    }
    function shouldUseWorkerTranslate(seoConfiguration, hostname) {
      return usesSeoRouting(seoConfiguration) && hostnameMatchesSeoConfiguration(hostname, seoConfiguration);
    }
    const WORKER_TRANSLATE_PATH = "/__camb__/translate/text-based";
    function resolveWorkerTranslateUrl() {
      if (typeof window === "undefined") {
        return null;
      }
      return `${window.location.origin}${WORKER_TRANSLATE_PATH}`;
    }
    function resolveLanguageFromSeoUrl(args) {
      const seoContext = resolveSeoContext(args);
      if (seoContext.mode !== "source" && seoContext.pageLang) {
        return seoContext.pageLang;
      }
      return null;
    }
    function resolveLanguageFromPreferences(args) {
      if (args.savedLang && (args.targetLanguages.includes(args.savedLang) || args.savedLang === args.defaultLang)) {
        return args.savedLang;
      }
      if (!args.disableAutoBrowserTranslation && args.browserLang) {
        if (args.browserLang !== args.defaultLang && args.targetLanguages.includes(args.browserLang)) {
          return args.browserLang;
        }
        const matchingLang = args.targetLanguages.find(
          (lang) => args.browserLang.startsWith(lang) || lang.startsWith(args.browserLang)
        );
        if (matchingLang) {
          return matchingLang;
        }
      }
      return args.defaultLang;
    }
    function resolveInitialLanguage(args) {
      const seoContext = resolveSeoContext({
        seoConfiguration: args.seoConfiguration,
        defaultLang: args.defaultLang,
        hostname: args.hostname,
        pathname: args.pathname
      });
      if (usesSeoRouting(args.seoConfiguration)) {
        if (seoContext.mode !== "source" && seoContext.pageLang) {
          return seoContext.pageLang;
        }
        return args.defaultLang;
      }
      return resolveLanguageFromPreferences(args);
    }
    function shouldNavigateForSeoLanguageChange(seoConfiguration) {
      return usesSeoRouting(seoConfiguration);
    }
    class ConfigManager {
      constructor(apiService, scriptConfig) {
        this.apiService = apiService;
        this.scriptConfig = scriptConfig;
        this.state = {
          translationConfig: null,
          apiConfig: null,
          currentLang: "en"
        };
        this.seoContext = { mode: "source" };
      }
      getState() {
        return { ...this.state };
      }
      updateState(updates) {
        this.state = { ...this.state, ...updates };
      }
      getSeoContext() {
        return this.seoContext;
      }
      refreshSeoContextFromLocation() {
        const translationConfig = this.state.translationConfig;
        if (!translationConfig) {
          return;
        }
        this.seoContext = resolveSeoContext({
          seoConfiguration: translationConfig.seoConfiguration,
          defaultLang: translationConfig.defaultLang,
          hostname: window.location.hostname,
          pathname: window.location.pathname
        });
        const urlLanguage = resolveLanguageFromSeoUrl({
          seoConfiguration: translationConfig.seoConfiguration,
          defaultLang: translationConfig.defaultLang,
          hostname: window.location.hostname,
          pathname: window.location.pathname
        });
        if (urlLanguage) {
          this.setCurrentLanguage(urlLanguage, { persist: true });
        }
      }
      async initializeConfig() {
        const { apiKey, domain } = this.scriptConfig;
        if (!apiKey) {
          console.error("❌ No API key provided. Translation disabled.");
          return null;
        }
        const maxRetries = 5;
        let retryCount = 0;
        let delay = 500;
        while (retryCount < maxRetries) {
          try {
            const config = await this.apiService.fetchConfig(apiKey, domain);
            const translationConfig = {
              defaultLang: config.defaultLang,
              languageLabels: config.languageLabels,
              targetLanguages: config.targetLanguages,
              domain: config.domain,
              websiteId: config.websiteId,
              teamId: config.teamId,
              seoConfiguration: config.seoConfiguration ?? null
            };
            const configApiUrl = this.apiService.getConfigApiUrl();
            this.seoContext = resolveSeoContext({
              seoConfiguration: translationConfig.seoConfiguration,
              defaultLang: translationConfig.defaultLang,
              hostname: window.location.hostname,
              pathname: window.location.pathname
            });
            const translateApiUrl = shouldUseWorkerTranslate(
              translationConfig.seoConfiguration,
              window.location.hostname
            ) ? resolveWorkerTranslateUrl() ?? void 0 : void 0;
            const apiConfig = {
              key: apiKey,
              domain: translationConfig.domain,
              configApiUrl,
              translateApiUrl
            };
            const initialLang = resolveInitialLanguage({
              seoConfiguration: translationConfig.seoConfiguration,
              defaultLang: translationConfig.defaultLang,
              targetLanguages: translationConfig.targetLanguages,
              savedLang: this.scriptConfig.followParentLanguage ? null : StorageManager.loadSelectedLanguage(),
              browserLang: DomUtils.getBrowserLanguage(),
              disableAutoBrowserTranslation: this.scriptConfig.followParentLanguage === true || this.scriptConfig.disableAutoBrowserTranslation === true,
              hostname: window.location.hostname,
              pathname: window.location.pathname
            });
            this.updateState({
              translationConfig,
              apiConfig,
              currentLang: initialLang
            });
            if (usesSeoRouting(translationConfig.seoConfiguration) && this.seoContext.mode !== "source") {
              StorageManager.saveSelectedLanguage(initialLang);
            } else if (usesSeoRouting(translationConfig.seoConfiguration) && this.seoContext.mode === "source") {
              StorageManager.clearSelectedLanguage();
            }
            return translationConfig;
          } catch (e) {
            retryCount++;
            if (e instanceof Error && e.message === "RATE_LIMIT") {
              console.error("❌ Rate limit exceeded. Stopping retries.");
              break;
            }
            console.warn(
              `⚠️ Config fetch attempt ${retryCount} failed: ${e.message}. Retrying in ${delay}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay = Math.min(delay * 2, 4e3);
          }
        }
        console.error("❌ Failed to initialize translation script after all retries");
        this.updateState({
          translationConfig: null,
          apiConfig: null
        });
        return null;
      }
      getCurrentLanguage() {
        return this.state.currentLang;
      }
      getTranslationConfig() {
        return this.state.translationConfig;
      }
      getApiConfig() {
        return this.state.apiConfig;
      }
      setCurrentLanguage(lang, options) {
        this.updateState({ currentLang: lang });
        if ((options == null ? void 0 : options.persist) !== false) {
          StorageManager.saveSelectedLanguage(lang);
        }
      }
      isInDefaultLanguage() {
        var _a;
        return this.state.currentLang === ((_a = this.state.translationConfig) == null ? void 0 : _a.defaultLang);
      }
    }
    function getTranslatorThemeColors(theme) {
      return theme === "light" ? {
        bg: "#ffffff",
        bgHover: "#f5f5f5",
        color: "#333333",
        border: "1px solid #e0e0e0",
        shadow: "0 2px 8px rgba(0,0,0,0.1)",
        optionBg: "#ffffff",
        optionColor: "#333333"
      } : {
        bg: "#333333",
        bgHover: "#555555",
        color: "#ffffff",
        border: "none",
        shadow: "0 2px 8px rgba(0,0,0,0.3)",
        optionBg: "#333333",
        optionColor: "#ffffff"
      };
    }
    const POPOVER_OFFSET = 8;
    const BTN_SECONDARY_BG = "#353535";
    const BTN_SECONDARY_COLOR = "#ffffff";
    function estimateTextareaRows(text, maxRows) {
      const lines = text.split(/\n/).length;
      const approxWrap = Math.ceil(text.length / 48);
      return Math.min(maxRows, Math.max(3, lines, approxWrap));
    }
    class CacheEditorOverlay {
      constructor(theme, actions) {
        this.theme = theme;
        this.actions = actions;
        this.popover = null;
        this.sourceField = null;
        this.translationField = null;
        this.saveBtn = null;
        this.cancelBtn = null;
        this.closeBtn = null;
        this.saving = false;
        this.hoveredElement = null;
        this.anchorElement = null;
        this.draftSnapshot = "";
        this.popoverOpen = false;
        this.hideTransitionTimer = null;
        this.themeColors = getTranslatorThemeColors(theme);
        this.boundDocKeydown = (e) => this.onDocumentKeydown(e);
        this.boundDocPointerDown = (e) => this.onDocumentPointerDown(e);
      }
      create() {
        const existing = document.getElementById(CACHE_EDITOR_SELECTORS.POPOVER_STYLE);
        if (existing) existing.remove();
        const t = getTranslatorThemeColors(this.theme);
        const isDark = this.theme === "dark";
        const fieldBg = isDark ? "rgba(255,255,255,0.06)" : "#f5f5f5";
        const fieldBorder = isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e0e0e0";
        const muted = isDark ? "rgba(255,255,255,0.55)" : "#666666";
        const headerBorder = isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e8e8e8";
        const style = document.createElement("style");
        style.id = CACHE_EDITOR_SELECTORS.POPOVER_STYLE;
        style.textContent = `
              #${CACHE_EDITOR_SELECTORS.POPOVER} {
                  position: fixed;
                  z-index: 2147483647;
                  width: clamp(320px, min(90vw, 560px), 90vw);
                  max-width: 90vw;
                  max-height: calc(100vh - 32px);
                  overflow-y: auto;
                  background: var(--tl-bg, ${t.bg});
                  color: var(--tl-color, ${t.color});
                  border: var(--tl-border, ${t.border});
                  border-radius: 8px;
                  box-shadow: var(--tl-box-shadow, ${t.shadow});
                  padding: 14px 14px 12px;
                  font-family: var(--tl-font-family, 'Inter', sans-serif);
                  font-size: 13px;
                  line-height: 1.45;
                  box-sizing: border-box;
                  pointer-events: auto;
                  opacity: 0;
                  transform: translateY(6px) scale(0.98);
                  transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER}.ce-popover--visible {
                  opacity: 1;
                  transform: translateY(0) scale(1);
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-label {
                  display: block;
                  font-size: 11px;
                  font-weight: 600;
                  color: ${muted};
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  margin-bottom: 6px;
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-field {
                  margin-bottom: 12px;
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-footer {
                  display: flex;
                  justify-content: flex-end;
                  gap: 8px;
                  margin-top: 4px;
                  padding-top: 10px;
                  border-top: ${headerBorder};
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} textarea {
                  width: 100%;
                  box-sizing: border-box;
                  border: ${fieldBorder};
                  border-radius: 6px;
                  padding: 8px 10px;
                  font-size: 13px;
                  font-family: inherit;
                  color: var(--tl-color, ${t.color});
                  background: ${fieldBg};
                  outline: none;
                  line-height: 1.5;
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} textarea.ce-source {
                  resize: none;
                  max-height: 200px;
                  overflow-y: auto;
                  opacity: 0.75;
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} textarea.ce-translation {
                  resize: vertical;
                  min-height: 72px;
                  max-height: 240px;
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} textarea.ce-translation:focus {
                  box-shadow: 0 0 0 2px var(--tl-color, ${t.color});
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-header {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  margin-bottom: 10px;
                  padding-bottom: 8px;
                  border-bottom: ${headerBorder};
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-title {
                  font-size: 13px;
                  font-weight: 600;
                  color: var(--tl-color, ${t.color});
                  letter-spacing: 0.02em;
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-close {
                  width: 28px;
                  height: 28px;
                  border: none;
                  background: transparent;
                  cursor: pointer;
                  color: ${muted};
                  font-size: 18px;
                  line-height: 1;
                  padding: 0;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border-radius: 6px;
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-close:hover {
                  background: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"};
                  color: ${t.color};
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-btn {
                  font-family: inherit;
                  font-size: 13px;
                  font-weight: 600;
                  padding: 8px 16px;
                  border-radius: 6px;
                  border: none;
                  cursor: pointer;
                  transition: opacity 0.15s ease, filter 0.15s ease;
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-btn:disabled {
                  opacity: 0.55;
                  cursor: not-allowed;
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-btn-secondary {
                  background: ${BTN_SECONDARY_BG};
                  color: ${BTN_SECONDARY_COLOR};
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-btn-secondary:hover:not(:disabled) {
                  filter: brightness(1.08);
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-btn-primary {
                  background: var(--tl-bg-hover, ${t.bgHover});
                  color: var(--tl-color, ${t.color});
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-btn-primary:hover:not(:disabled) {
                  filter: brightness(0.95);
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-btn-primary.ce-saving {
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  gap: 8px;
                  min-width: 72px;
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER} .ce-btn-primary.ce-saving::after {
                  content: '';
                  width: 14px;
                  height: 14px;
                  border: 2px solid currentColor;
                  border-top-color: transparent;
                  border-radius: 50%;
                  animation: ce-spin 0.65s linear infinite;
                  flex-shrink: 0;
              }
  
              @keyframes ce-spin {
                  to { transform: rotate(360deg); }
              }
  
              #${CACHE_EDITOR_SELECTORS.POPOVER}.ce-popover--locked .ce-close:disabled,
              #${CACHE_EDITOR_SELECTORS.POPOVER}.ce-popover--locked textarea:disabled {
                  opacity: 0.65;
                  cursor: not-allowed;
              }
          `;
        document.head.appendChild(style);
      }
      isPopoverOpen() {
        return this.popoverOpen;
      }
      isSaving() {
        return this.saving;
      }
      getTranslationDraft() {
        var _a;
        return ((_a = this.translationField) == null ? void 0 : _a.value) ?? "";
      }
      setSaving(saving) {
        var _a;
        this.saving = saving;
        if (this.saveBtn) {
          this.saveBtn.disabled = saving;
          this.saveBtn.classList.toggle("ce-saving", saving);
          this.saveBtn.setAttribute("aria-busy", saving ? "true" : "false");
        }
        if (this.cancelBtn) this.cancelBtn.disabled = saving;
        if (this.closeBtn) this.closeBtn.disabled = saving;
        if (this.translationField) this.translationField.disabled = saving;
        (_a = this.popover) == null ? void 0 : _a.classList.toggle("ce-popover--locked", saving);
      }
      /** Restore translation field to the value it had when the popover opened. */
      revertDraft() {
        if (this.translationField) this.translationField.value = this.draftSnapshot;
      }
      // ─── Hover indicator (no popover) ────────────────────────────────────────
      // Inline styles with 'important' are used so site-CSS specificity wars
      // (e.g. Bootstrap's `.accordion-button { outline: none !important }`) cannot
      // override our indicator — inline !important always wins over stylesheets.
      applyHover(element) {
        if (this.hoveredElement === element) return;
        this.clearHover();
        this.hoveredElement = element;
        const color = `var(--tl-bg, ${this.themeColors.bg})`;
        element.style.setProperty("outline", `1.5px dashed ${color}`, "important");
        element.style.setProperty("outline-offset", "2px", "important");
        element.style.setProperty("cursor", "text", "important");
      }
      clearHover() {
        if (this.hoveredElement) {
          this.hoveredElement.style.removeProperty("outline");
          this.hoveredElement.style.removeProperty("outline-offset");
          this.hoveredElement.style.removeProperty("cursor");
          this.hoveredElement = null;
        }
      }
      // ─── Click-active highlight (popover anchor) ──────────────────────────────
      highlightElement(element) {
        if (this.anchorElement === element) return;
        this.clearHighlight();
        this.anchorElement = element;
        const color = `var(--tl-bg, ${this.themeColors.bg})`;
        element.style.setProperty("outline", `2px solid ${color}`, "important");
        element.style.setProperty("outline-offset", "2px", "important");
      }
      clearHighlight() {
        if (this.anchorElement) {
          this.anchorElement.style.removeProperty("outline");
          this.anchorElement.style.removeProperty("outline-offset");
        }
      }
      // ─── Popover ──────────────────────────────────────────────────────────────
      showPopover(anchorElement, sourceText) {
        this.ensurePopover();
        if (!this.popover || !this.sourceField || !this.translationField) return;
        const rawInitial = Array.from(anchorElement.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? "").join("");
        const displaySource = sourceText.trim();
        const initial = rawInitial.trim();
        this.sourceField.value = displaySource;
        this.translationField.value = initial;
        this.draftSnapshot = initial;
        this.sourceField.rows = estimateTextareaRows(displaySource, 14);
        this.translationField.rows = Math.max(3, estimateTextareaRows(initial || " ", 12));
        this.highlightElement(anchorElement);
        this.popover.style.display = "block";
        this.popover.classList.remove("ce-popover--visible");
        this.popoverOpen = true;
        document.addEventListener("keydown", this.boundDocKeydown, true);
        document.addEventListener("mousedown", this.boundDocPointerDown, true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            var _a;
            if (!this.popover) return;
            this.positionPopover(anchorElement);
            this.popover.classList.add("ce-popover--visible");
            (_a = this.translationField) == null ? void 0 : _a.focus({ preventScroll: true });
          });
        });
      }
      hidePopover() {
        if (!this.popover) return;
        document.removeEventListener("keydown", this.boundDocKeydown, true);
        document.removeEventListener("mousedown", this.boundDocPointerDown, true);
        if (this.saving) this.setSaving(false);
        this.popover.classList.remove("ce-popover--visible");
        this.popoverOpen = false;
        this.clearHighlight();
        this.anchorElement = null;
        if (this.hideTransitionTimer !== null) window.clearTimeout(this.hideTransitionTimer);
        this.hideTransitionTimer = window.setTimeout(() => {
          this.hideTransitionTimer = null;
          if (this.popover && !this.popoverOpen) {
            this.popover.style.display = "none";
          }
        }, 220);
      }
      reposition(anchor) {
        if (this.popoverOpen) this.positionPopover(anchor);
      }
      onDocumentKeydown(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          if (this.saving) return;
          this.actions.onCancel();
        }
      }
      /** Any click outside the popover closes it — blocked while a save is in flight. */
      onDocumentPointerDown(e) {
        if (this.saving) return;
        const target = e.target;
        if (!target || !this.popover) return;
        if (this.popover.contains(target)) return;
        this.actions.onCancel();
      }
      ensurePopover() {
        var _a, _b, _c;
        if (this.popover) return;
        const popover = document.createElement("div");
        popover.id = CACHE_EDITOR_SELECTORS.POPOVER;
        popover.setAttribute(ATTRIBUTES.NO_TRANSLATE, "true");
        popover.style.display = "none";
        popover.innerHTML = `
              <div class="ce-header">
                  <span class="ce-title">Edit translation</span>
                  <button type="button" class="ce-close" aria-label="Close">&#x2715;</button>
              </div>
              <div class="ce-field">
                  <label class="ce-label" for="ce-source-input">Source</label>
                  <textarea id="ce-source-input" class="ce-source" readonly></textarea>
              </div>
              <div class="ce-field">
                  <label class="ce-label" for="ce-translation-input">Translation</label>
                  <textarea id="ce-translation-input" class="ce-translation" placeholder="Translated text…"></textarea>
              </div>
              <div class="ce-footer">
                  <button type="button" class="ce-btn ce-btn-secondary ce-cancel">Cancel</button>
                  <button type="button" class="ce-btn ce-btn-primary ce-save">Save</button>
              </div>
          `;
        this.closeBtn = popover.querySelector(".ce-close");
        (_a = this.closeBtn) == null ? void 0 : _a.addEventListener("click", () => {
          if (!this.saving) this.actions.onCancel();
        });
        this.cancelBtn = popover.querySelector(".ce-cancel");
        this.saveBtn = popover.querySelector(".ce-save");
        (_b = this.cancelBtn) == null ? void 0 : _b.addEventListener("click", () => {
          if (!this.saving) this.actions.onCancel();
        });
        (_c = this.saveBtn) == null ? void 0 : _c.addEventListener("click", () => void this.actions.onSave());
        document.body.appendChild(popover);
        this.popover = popover;
        this.sourceField = popover.querySelector(".ce-source");
        this.translationField = popover.querySelector(".ce-translation");
      }
      positionPopover(anchor) {
        if (!this.popover) return;
        const rect = anchor.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = POPOVER_OFFSET;
        const popW = this.popover.offsetWidth || 360;
        const popH = this.popover.offsetHeight || 220;
        let left = rect.right + margin;
        let top = rect.top;
        if (left + popW > vw - margin) {
          left = rect.left - popW - margin;
        }
        if (left < margin) {
          left = margin;
        }
        if (top + popH > vh - margin) {
          top = Math.max(margin, vh - popH - margin);
        }
        if (top < margin) {
          top = margin;
        }
        const overlapsAnchor = left < rect.right + margin && left + popW > rect.left - margin && top < rect.bottom + margin && top + popH > rect.top - margin;
        if (overlapsAnchor) {
          const below = rect.bottom + margin;
          if (below + popH <= vh - margin) {
            top = below;
          } else {
            const above = rect.top - popH - margin;
            if (above >= margin) {
              top = above;
            }
          }
        }
        this.popover.style.left = `${Math.round(left)}px`;
        this.popover.style.top = `${Math.round(top)}px`;
      }
    }
    const DEFAULT_PILL_SIZE = 50;
    const GAP = EDIT_PILL_LAYOUT.GAP;
    const DROPDOWN_WAIT_MS = 8e3;
    const DROPDOWN_POLL_MS = 50;
    const PENCIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>`;
    const CLOSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`;
    class CacheEditorPill {
      constructor(theme) {
        this.theme = theme;
        this.active = false;
        this.dropdownObserver = null;
        this.resizeObserver = null;
        this.pollTimer = null;
        this.onToggle = null;
        this.boundSyncPosition = () => this.syncPosition();
      }
      mount() {
        if (document.getElementById(CACHE_EDITOR_SELECTORS.EDIT_PILL)) return;
        this.injectStyles();
        this.renderPill();
        this.attachWhenDropdownReady();
      }
      unmount() {
        var _a, _b, _c, _d, _e, _f;
        if (this.pollTimer !== null) {
          window.clearInterval(this.pollTimer);
          this.pollTimer = null;
        }
        (_a = this.dropdownObserver) == null ? void 0 : _a.disconnect();
        this.dropdownObserver = null;
        (_b = this.resizeObserver) == null ? void 0 : _b.disconnect();
        this.resizeObserver = null;
        window.removeEventListener("resize", this.boundSyncPosition);
        window.removeEventListener("scroll", this.boundSyncPosition, true);
        (_c = window.visualViewport) == null ? void 0 : _c.removeEventListener("resize", this.boundSyncPosition);
        (_d = window.visualViewport) == null ? void 0 : _d.removeEventListener("scroll", this.boundSyncPosition);
        (_e = document.getElementById(CACHE_EDITOR_SELECTORS.EDIT_PILL_STYLE)) == null ? void 0 : _e.remove();
        (_f = document.getElementById(CACHE_EDITOR_SELECTORS.EDIT_PILL)) == null ? void 0 : _f.remove();
        this.active = false;
      }
      injectStyles() {
        const t = getTranslatorThemeColors(this.theme);
        const id = CACHE_EDITOR_SELECTORS.EDIT_PILL;
        const style = document.createElement("style");
        style.id = CACHE_EDITOR_SELECTORS.EDIT_PILL_STYLE;
        style.textContent = `
              #${id} {
                  position: var(--tl-position, fixed);
                  z-index: var(--tl-z-index, 2147483647);
                  width: ${DEFAULT_PILL_SIZE}px;
                  height: ${DEFAULT_PILL_SIZE}px;
                  box-sizing: border-box;
                  border-radius: 50%;
                  background: var(--tl-bg, ${t.bg});
                  border: var(--tl-border, ${t.border});
                  box-shadow: var(--tl-box-shadow, ${t.shadow});
                  color: var(--tl-color, ${t.color});
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  cursor: pointer;
                  padding: 0;
                  transition: var(--tl-transition, transform 0.2s ease);
                  font-family: var(--tl-font-family, 'Inter', sans-serif);
                  will-change: transform;
              }
  
              #${id} svg {
                  width: 40%;
                  height: 40%;
                  flex-shrink: 0;
              }
  
              #${id}:hover {
                  transform: scale(1.05);
              }
  
              #${id}.${id}--active {
                  background: var(--tl-bg, ${t.bg});
                  border: var(--tl-border, ${t.border});
                  box-shadow: var(--tl-box-shadow, ${t.shadow});
                  color: var(--tl-color, ${t.color});
              }
  
              #${id}.${id}--active:hover {
                  transform: scale(1.05);
              }
          `;
        document.head.appendChild(style);
      }
      renderPill() {
        const pill = document.createElement("button");
        pill.id = CACHE_EDITOR_SELECTORS.EDIT_PILL;
        pill.setAttribute("type", "button");
        pill.setAttribute("aria-label", "Toggle edit mode");
        pill.setAttribute("aria-pressed", "false");
        pill.setAttribute(ATTRIBUTES.NO_TRANSLATE, "true");
        pill.innerHTML = PENCIL_SVG;
        pill.addEventListener("click", (e) => {
          var _a;
          e.stopPropagation();
          this.active = !this.active;
          pill.classList.toggle(`${CACHE_EDITOR_SELECTORS.EDIT_PILL}--active`, this.active);
          pill.setAttribute("aria-pressed", String(this.active));
          pill.innerHTML = this.active ? CLOSE_SVG : PENCIL_SVG;
          (_a = this.onToggle) == null ? void 0 : _a.call(this, this.active);
        });
        document.body.appendChild(pill);
      }
      syncPosition() {
        const pill = document.getElementById(CACHE_EDITOR_SELECTORS.EDIT_PILL);
        const drop = document.getElementById(SELECTORS.DROPDOWN_CONTAINER);
        if (!pill || !drop) return;
        const r = drop.getBoundingClientRect();
        const pillW = r.width > 0 ? r.width : DEFAULT_PILL_SIZE;
        const pillH = r.height > 0 ? r.height : DEFAULT_PILL_SIZE;
        pill.style.width = `${pillW}px`;
        pill.style.height = `${pillH}px`;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = EDIT_PILL_LAYOUT.VIEWPORT_MARGIN;
        let left = r.left + r.width / 2 - pillW / 2;
        const aboveTop = r.top - GAP - pillH;
        const belowTop = r.bottom + GAP;
        let top = aboveTop >= margin ? aboveTop : belowTop;
        left = Math.max(margin, Math.min(left, vw - pillW - margin));
        top = Math.max(margin, Math.min(top, vh - pillH - margin));
        pill.style.left = `${Math.round(left)}px`;
        pill.style.top = `${Math.round(top)}px`;
        pill.style.right = "auto";
        pill.style.bottom = "auto";
      }
      /** Move main pill down so edit pill can sit above (handles CSS --tl-* placement, not just inline styles). */
      nudgeDropdownIfEditPillOverlaps() {
        const drop = document.getElementById(SELECTORS.DROPDOWN_CONTAINER);
        if (!drop) return;
        const rect = drop.getBoundingClientRect();
        const h = rect.height > 0 ? rect.height : DEFAULT_PILL_SIZE;
        const minTop = EDIT_PILL_LAYOUT.VIEWPORT_MARGIN + EDIT_PILL_LAYOUT.GAP + h;
        if (rect.top >= minTop) return;
        const delta = minTop - rect.top;
        const inlineTop = drop.style.top;
        if (inlineTop) {
          const parsed = parseFloat(inlineTop);
          if (!Number.isNaN(parsed)) {
            drop.style.top = `${parsed + delta}px`;
            return;
          }
        }
        const inlineBottom = drop.style.bottom;
        if (inlineBottom && inlineBottom !== "auto") {
          const parsed = parseFloat(inlineBottom);
          if (!Number.isNaN(parsed)) {
            drop.style.bottom = `${Math.max(0, parsed - delta)}px`;
            return;
          }
        }
        drop.style.top = `${minTop}px`;
        drop.style.left = `${rect.left}px`;
        drop.style.right = "auto";
        drop.style.bottom = "auto";
      }
      attachWhenDropdownReady() {
        const start = Date.now();
        const tryAttach = () => {
          var _a, _b, _c;
          const drop = document.getElementById(SELECTORS.DROPDOWN_CONTAINER);
          if (!drop) return false;
          if (this.pollTimer !== null) {
            window.clearInterval(this.pollTimer);
            this.pollTimer = null;
          }
          this.nudgeDropdownIfEditPillOverlaps();
          this.syncPosition();
          window.addEventListener("resize", this.boundSyncPosition);
          window.addEventListener("scroll", this.boundSyncPosition, true);
          (_a = window.visualViewport) == null ? void 0 : _a.addEventListener("resize", this.boundSyncPosition);
          (_b = window.visualViewport) == null ? void 0 : _b.addEventListener("scroll", this.boundSyncPosition);
          this.dropdownObserver = new MutationObserver(() => this.syncPosition());
          this.dropdownObserver.observe(drop, { attributes: true, attributeFilter: ["style", "class"] });
          (_c = this.resizeObserver) == null ? void 0 : _c.disconnect();
          this.resizeObserver = new ResizeObserver(() => this.syncPosition());
          this.resizeObserver.observe(drop);
          return true;
        };
        if (tryAttach()) return;
        this.pollTimer = window.setInterval(() => {
          if (tryAttach()) return;
          if (Date.now() - start > DROPDOWN_WAIT_MS && this.pollTimer !== null) {
            window.clearInterval(this.pollTimer);
            this.pollTimer = null;
          }
        }, DROPDOWN_POLL_MS);
      }
    }
    class TextFinder {
      /**
       * Walks up from the element under the cursor to the first ancestor that holds
       * the translator stamps (same element as TextTarget.parent when translated).
       * Requires both data-tl-src and data-tl-to — source-language pages stay inert.
       */
      static findTargetAt(element) {
        let current = element;
        while (current && current !== document.body && current !== document.documentElement) {
          if (DomUtils.isNonContentElement(current)) return null;
          const targetLanguage = current.getAttribute(ATTRIBUTES.TRANSLATED_TO);
          const sourceText = current.getAttribute(ATTRIBUTES.SOURCE_TEXT);
          if (targetLanguage && sourceText) {
            return { element: current, sourceText, targetLanguage };
          }
          current = current.parentElement;
        }
        return null;
      }
    }
    const queued = /* @__PURE__ */ new WeakSet();
    const translated = /* @__PURE__ */ new WeakSet();
    const translatedTextStore = /* @__PURE__ */ new WeakMap();
    const translatedAttributeStore = /* @__PURE__ */ new WeakMap();
    function setTranslatedText(node, translatedText) {
      translatedTextStore.set(node, translatedText.trim());
    }
    function getTranslatedText(node) {
      return translatedTextStore.get(node);
    }
    function clearTranslatedText(node) {
      translatedTextStore.delete(node);
    }
    function setTranslatedAttribute(element, attribute, translatedValue) {
      const existing = translatedAttributeStore.get(element) || /* @__PURE__ */ new Map();
      existing.set(attribute, translatedValue.trim());
      translatedAttributeStore.set(element, existing);
    }
    function getTranslatedAttribute(element, attribute) {
      const map = translatedAttributeStore.get(element);
      return map == null ? void 0 : map.get(attribute);
    }
    function clearTranslatedAttribute(element, attribute) {
      if (!attribute) {
        translatedAttributeStore.delete(element);
        return;
      }
      const map = translatedAttributeStore.get(element);
      if (!map) return;
      map.delete(attribute);
      if (map.size === 0) {
        translatedAttributeStore.delete(element);
      }
    }
    function findFirstMeaningfulTextNode(parent) {
      const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          var _a;
          const text = (_a = node.textContent) == null ? void 0 : _a.trim();
          return text ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      return walker.nextNode();
    }
    function applyManualTranslationToParent(parentElement, sourceText, newTranslation, targetLang) {
      var _a, _b;
      const liveNode = findFirstMeaningfulTextNode(parentElement);
      if (!liveNode) return;
      if (!parentElement.hasAttribute(ATTRIBUTES.SOURCE_TEXT)) {
        parentElement.setAttribute(ATTRIBUTES.SOURCE_TEXT, sourceText);
      }
      parentElement.setAttribute(ATTRIBUTES.TRANSLATION_STATE, "translated");
      parentElement.setAttribute(ATTRIBUTES.TRANSLATED_TO, targetLang);
      const trimmedTranslated = newTranslation.trim();
      setTranslatedText(liveNode, trimmedTranslated);
      const leadingWs = ((_a = sourceText.match(/^\s+/)) == null ? void 0 : _a[0]) || "";
      const trailingWs = ((_b = sourceText.match(/\s+$/)) == null ? void 0 : _b[0]) || "";
      liveNode.textContent = `${leadingWs}${trimmedTranslated}${trailingWs}`;
    }
    const REPOSITION_DEBOUNCE_MS = 24;
    class CacheEditorService {
      constructor(apiService, configManager, theme) {
        this.apiService = apiService;
        this.configManager = configManager;
        this.currentTarget = null;
        this.repositionTimer = null;
        this.hoverDebounceTimer = null;
        this.editModeActive = false;
        this.overlay = new CacheEditorOverlay(theme, {
          onSave: () => this.handleSave(),
          onCancel: () => this.handleCancel()
        });
        this.pill = new CacheEditorPill(theme);
        this.pill.onToggle = (active) => this.setEditMode(active);
        this.boundHandleMouseOver = (e) => this.handleMouseOver(e);
        this.boundHandleMouseOut = (e) => this.handleMouseOut(e);
        this.boundHandleClick = (e) => this.handleClick(e);
        this.boundReposition = () => this.scheduleReposition();
      }
      start() {
        this.overlay.create();
        this.pill.mount();
        document.addEventListener("mouseover", this.boundHandleMouseOver);
        document.addEventListener("mouseout", this.boundHandleMouseOut);
        document.addEventListener("click", this.boundHandleClick, true);
        window.addEventListener("resize", this.boundReposition, true);
        window.addEventListener("scroll", this.boundReposition, true);
      }
      stop() {
        if (this.repositionTimer !== null) window.clearTimeout(this.repositionTimer);
        if (this.hoverDebounceTimer !== null) window.clearTimeout(this.hoverDebounceTimer);
        document.removeEventListener("mouseover", this.boundHandleMouseOver);
        document.removeEventListener("mouseout", this.boundHandleMouseOut);
        document.removeEventListener("click", this.boundHandleClick, true);
        window.removeEventListener("resize", this.boundReposition, true);
        window.removeEventListener("scroll", this.boundReposition, true);
        this.overlay.hidePopover();
        this.overlay.clearHover();
        this.pill.unmount();
      }
      // ─── Edit mode gate (toggled by the pill next to the language widget) ─────
      setEditMode(active) {
        this.editModeActive = active;
        if (!active) {
          if (!this.overlay.isSaving()) {
            this.overlay.hidePopover();
          }
          this.overlay.clearHover();
          this.currentTarget = null;
        }
      }
      // ─── Hover — indicate only, never open ───────────────────────────────────
      handleMouseOver(e) {
        if (!this.editModeActive) return;
        const element = e.target;
        if (!element || DomUtils.isNonContentElement(element)) return;
        const popoverId = CACHE_EDITOR_SELECTORS.POPOVER;
        if (element.id === popoverId || element.closest(`#${popoverId}`)) return;
        const editPillId = CACHE_EDITOR_SELECTORS.EDIT_PILL;
        if (element.id === editPillId || element.closest(`#${editPillId}`)) return;
        const dropdownId = SELECTORS.DROPDOWN_CONTAINER;
        if (element.id === dropdownId || element.closest(`#${dropdownId}`)) return;
        const clientX = e.clientX;
        const clientY = e.clientY;
        if (this.hoverDebounceTimer !== null) window.clearTimeout(this.hoverDebounceTimer);
        this.hoverDebounceTimer = window.setTimeout(() => {
          this.hoverDebounceTimer = null;
          const target = this.resolveTarget(element, clientX, clientY, "hover");
          if (target) {
            this.overlay.applyHover(target.element);
          } else {
            this.overlay.clearHover();
          }
        }, CACHE_EDITOR_TIMINGS.HOVER_DEBOUNCE);
      }
      handleMouseOut(e) {
        var _a;
        if (!this.editModeActive) return;
        if (this.hoverDebounceTimer !== null) {
          window.clearTimeout(this.hoverDebounceTimer);
          this.hoverDebounceTimer = null;
        }
        const related = e.relatedTarget;
        if (related && ((_a = e.target) == null ? void 0 : _a.contains(related))) return;
        this.overlay.clearHover();
      }
      // ─── Click — intercept default actions + open (or switch) popover ────────
      handleClick(e) {
        var _a;
        if (!this.editModeActive) return;
        const element = e.target;
        if (!element) return;
        const popoverId = CACHE_EDITOR_SELECTORS.POPOVER;
        if (element.id === popoverId || element.closest(`#${popoverId}`)) return;
        const editPillId = CACHE_EDITOR_SELECTORS.EDIT_PILL;
        if (element.id === editPillId || element.closest(`#${editPillId}`)) return;
        const dropdownId = SELECTORS.DROPDOWN_CONTAINER;
        if (element.id === dropdownId || element.closest(`#${dropdownId}`)) return;
        const target = this.resolveTarget(element, e.clientX, e.clientY, "click");
        if (!target) return;
        e.preventDefault();
        e.stopPropagation();
        if (this.overlay.isSaving()) return;
        if (this.overlay.isPopoverOpen() && ((_a = this.currentTarget) == null ? void 0 : _a.element) === target.element) return;
        if (this.overlay.isPopoverOpen()) {
          this.overlay.hidePopover();
        }
        this.currentTarget = target;
        this.overlay.showPopover(target.element, target.sourceText);
      }
      resolveTarget(element, clientX, clientY, mode) {
        let target = TextFinder.findTargetAt(element);
        if (target) return target;
        const stack = document.elementsFromPoint(clientX, clientY);
        for (const el of stack) {
          target = TextFinder.findTargetAt(el);
          if (target) return target;
        }
        if (mode === "click") {
          const pointerTarget = this.findPointerEventsNoneTranslatedAt(element, clientX, clientY);
          if (pointerTarget) {
            return TextFinder.findTargetAt(pointerTarget);
          }
        }
        return null;
      }
      findPointerEventsNoneTranslatedAt(root, clientX, clientY) {
        const selector = `[${ATTRIBUTES.TRANSLATED_TO}][${ATTRIBUTES.SOURCE_TEXT}]`;
        for (const node of root.querySelectorAll(selector)) {
          const el = node;
          if (window.getComputedStyle(el).pointerEvents !== "none") continue;
          const rect = el.getBoundingClientRect();
          if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
            return el;
          }
        }
        return null;
      }
      // ─── Save / Cancel ────────────────────────────────────────────────────────
      handleCancel() {
        if (this.overlay.isSaving()) return;
        this.overlay.revertDraft();
        this.overlay.hidePopover();
        this.currentTarget = null;
      }
      async handleSave() {
        if (this.overlay.isSaving()) return;
        const target = this.currentTarget;
        if (!target) return;
        const draft = this.overlay.getTranslationDraft();
        if (!draft.trim()) {
          ErrorHandler.showErrorMessage("config-invalid", "Translation cannot be empty.");
          return;
        }
        const translationConfig = this.configManager.getTranslationConfig();
        const apiConfig = this.configManager.getApiConfig();
        if (!translationConfig || !apiConfig) {
          ErrorHandler.showErrorMessage("config-invalid", "Translation is not configured.");
          return;
        }
        this.overlay.setSaving(true);
        try {
          await this.apiService.updateTranslationCache({
            apiConfig,
            sourceText: target.sourceText,
            targetLang: target.targetLanguage,
            value: draft
          });
          applyManualTranslationToParent(
            target.element,
            target.sourceText,
            draft,
            target.targetLanguage
          );
          this.overlay.hidePopover();
          this.currentTarget = null;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Could not save translation.";
          let errorType = "server";
          if (e instanceof TypeError && msg.includes("Failed to fetch")) {
            errorType = "network";
          } else if (msg.toLowerCase().includes("session") || msg.toLowerCase().includes("forbidden") || msg.toLowerCase().includes("not authorized")) {
            errorType = "auth";
          }
          ErrorHandler.showErrorMessage(errorType, msg);
        } finally {
          this.overlay.setSaving(false);
        }
      }
      // ─── Reposition on scroll / resize ───────────────────────────────────────
      scheduleReposition() {
        if (!this.overlay.isPopoverOpen() || !this.currentTarget) return;
        if (this.repositionTimer !== null) window.clearTimeout(this.repositionTimer);
        this.repositionTimer = window.setTimeout(() => {
          this.repositionTimer = null;
          if (this.currentTarget) this.overlay.reposition(this.currentTarget.element);
        }, REPOSITION_DEBOUNCE_MS);
      }
    }
    class LanguageDropdown {
      constructor(options) {
        this.options = options;
        this.container = null;
        this.iconButton = null;
        this.languageList = null;
        this.isExpanded = false;
        this.prevViewportWidth = 0;
        this.prevViewportHeight = 0;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragTimer = null;
        this.didDrag = false;
        this.isAnchored = false;
        this.usingBottomRightAnchor = true;
        this.handleMouseDown = (e) => {
          if (this.isExpanded || this.options.isTranslating || this.options.disabled) return;
          if (!this.container) return;
          const target = e.target;
          const isLink = target.closest("a") !== null;
          if (isLink) return;
          this.dragStartX = e.clientX;
          this.dragStartY = e.clientY;
          this.didDrag = false;
          this.isDragging = false;
          document.addEventListener("mousemove", this.handleMouseMove);
          document.addEventListener("mouseup", this.handleMouseUp);
        };
        this.handleMouseMove = (e) => {
          if (this.dragTimer) {
            clearTimeout(this.dragTimer);
            this.dragTimer = null;
          }
          if (!this.container) return;
          const dragThreshold = 5;
          const deltaX = Math.abs(e.clientX - this.dragStartX);
          const deltaY = Math.abs(e.clientY - this.dragStartY);
          if (!this.isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
            this.isDragging = true;
            this.didDrag = true;
            this.convertToPixelAnchor();
            if (this.iconButton) this.iconButton.style.cursor = "move";
            this.container.style.transition = "none";
          }
          if (!this.isDragging || this.isExpanded) return;
          const rect = this.container.getBoundingClientRect();
          const newX = e.clientX - this.dragStartX + rect.left;
          const newY = e.clientY - this.dragStartY + rect.top;
          const clamped = this.constrainToViewport(newX, newY);
          this.container.style.left = `${clamped.x}px`;
          this.container.style.top = `${clamped.y}px`;
          this.container.style.right = "auto";
          this.container.style.bottom = "auto";
          this.dragStartX = e.clientX;
          this.dragStartY = e.clientY;
          e.preventDefault();
          e.stopPropagation();
        };
        this.handleMouseUp = () => {
          if (this.dragTimer) {
            clearTimeout(this.dragTimer);
            this.dragTimer = null;
          }
          document.removeEventListener("mousemove", this.handleMouseMove);
          document.removeEventListener("mouseup", this.handleMouseUp);
          if (!this.container) return;
          if (this.isDragging) {
            this.isDragging = false;
            if (this.iconButton) this.iconButton.style.cursor = "pointer";
            this.container.style.transition = "";
            const rect = this.container.getBoundingClientRect();
            const rightOffset = Math.max(24, window.innerWidth - rect.right);
            const bottomOffset = Math.max(24, window.innerHeight - rect.bottom);
            this.savePosition({
              anchor: "br",
              x: rightOffset,
              y: bottomOffset
            });
            this.anchorContainerToBottomRight(rightOffset, bottomOffset);
            this.isAnchored = true;
            this.usingBottomRightAnchor = true;
          }
        };
        this.handleTouchStart = (e) => {
          if (this.isExpanded || this.options.isTranslating || this.options.disabled) return;
          if (!this.container) return;
          const target = e.target;
          const isLink = target.closest("a") !== null;
          if (isLink) return;
          const touch = e.touches[0];
          this.dragStartX = touch.clientX;
          this.dragStartY = touch.clientY;
          this.didDrag = false;
          this.isDragging = false;
          this.dragTimer = window.setTimeout(() => {
            this.isDragging = true;
          }, 200);
          document.addEventListener("touchmove", this.handleTouchMove, { passive: false });
          document.addEventListener("touchend", this.handleTouchEnd);
          e.preventDefault();
        };
        this.handleTouchMove = (e) => {
          if (this.dragTimer) {
            clearTimeout(this.dragTimer);
            this.dragTimer = null;
          }
          if (!this.container) return;
          const touch = e.touches[0];
          const dragThreshold = 5;
          const deltaX = Math.abs(touch.clientX - this.dragStartX);
          const deltaY = Math.abs(touch.clientY - this.dragStartY);
          if (!this.isDragging && (deltaX > dragThreshold || deltaY > dragThreshold)) {
            this.isDragging = true;
            this.didDrag = true;
            this.convertToPixelAnchor();
            if (this.iconButton) this.iconButton.style.cursor = "move";
            this.container.style.transition = "none";
          }
          if (!this.isDragging || this.isExpanded) return;
          const rect = this.container.getBoundingClientRect();
          const newX = touch.clientX - this.dragStartX + rect.left;
          const newY = touch.clientY - this.dragStartY + rect.top;
          const clamped = this.constrainToViewport(newX, newY);
          this.container.style.left = `${clamped.x}px`;
          this.container.style.top = `${clamped.y}px`;
          this.container.style.right = "auto";
          this.container.style.bottom = "auto";
          this.dragStartX = touch.clientX;
          this.dragStartY = touch.clientY;
          e.preventDefault();
        };
        this.handleTouchEnd = () => {
          if (this.dragTimer) {
            clearTimeout(this.dragTimer);
            this.dragTimer = null;
          }
          document.removeEventListener("touchmove", this.handleTouchMove);
          document.removeEventListener("touchend", this.handleTouchEnd);
          if (!this.container) return;
          if (!this.isDragging) {
            this.toggleLanguageList(new MouseEvent("click"));
            return;
          }
          this.isDragging = false;
          this.didDrag = false;
          if (this.iconButton) this.iconButton.style.cursor = "pointer";
          this.container.style.transition = "";
          if (this.container) {
            const rect = this.container.getBoundingClientRect();
            const rightOffset = Math.max(24, window.innerWidth - rect.right);
            const bottomOffset = Math.max(24, window.innerHeight - rect.bottom);
            this.savePosition({
              anchor: "br",
              x: rightOffset,
              y: bottomOffset
            });
            this.anchorContainerToBottomRight(rightOffset, bottomOffset);
            this.isAnchored = true;
            this.usingBottomRightAnchor = true;
          }
        };
        this.toggleLanguageList = (_e) => {
          if (!this.container || this.options.isTranslating || this.options.disabled) return;
          if (this.isDragging) {
            this.isDragging = false;
            return;
          }
          this.isExpanded = !this.isExpanded;
          this.container.classList.toggle("expanded", this.isExpanded);
          if (this.isExpanded && this.container && this.languageList) {
            this.positionLanguageList();
          }
        };
        this.closeLanguageList = () => {
          if (!this.container) return;
          this.isExpanded = false;
          this.container.classList.remove("expanded");
        };
        this.handleDocumentClick = (e) => {
          if (!this.container) return;
          const target = e.target;
          if (this.isExpanded && target && !this.container.contains(target)) {
            this.closeLanguageList();
          }
        };
        this.handleResize = () => {
          if (!this.container) return;
          const currW = window.innerWidth;
          const currH = window.innerHeight;
          const widthChanged = Math.abs(currW - this.prevViewportWidth) > 1;
          const heightDelta = Math.abs(currH - this.prevViewportHeight);
          const smallHeightOnlyChange = !widthChanged && heightDelta > 0 && heightDelta <= 120;
          this.prevViewportWidth = currW;
          this.prevViewportHeight = currH;
          if (this.usingBottomRightAnchor) {
            if (this.isExpanded) {
              this.positionLanguageList();
            }
            return;
          }
          if (this.isAnchored) {
            const rect = this.container.getBoundingClientRect();
            const minMargin = 24;
            const isOutside = rect.left < minMargin || rect.top < minMargin || rect.right > currW - minMargin || rect.bottom > currH - minMargin;
            if (widthChanged || isOutside || !smallHeightOnlyChange) {
              const clamped = this.constrainToViewport(rect.left, rect.top);
              this.anchorContainerToPixels(clamped.x, clamped.y);
              this.savePosition({ x: clamped.x, y: clamped.y });
            }
          }
          if (this.isExpanded) {
            this.positionLanguageList();
          }
        };
        this.positionLanguageList = () => {
          if (!this.container || !this.languageList || !this.iconButton) return;
          const containerRect = this.container.getBoundingClientRect();
          const buttonRect = this.iconButton.getBoundingClientRect();
          const listWidth = 200;
          const listHeight = this.languageList.offsetHeight;
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const margin = 10;
          let left;
          let top;
          let fitsHorizontally = false;
          const screenHalf = viewportWidth / 2;
          if (buttonRect.left > screenHalf) {
            left = buttonRect.left - listWidth - margin;
            if (left >= margin) {
              fitsHorizontally = true;
            } else {
              left = buttonRect.right + margin;
              if (left + listWidth + margin <= viewportWidth) {
                fitsHorizontally = true;
              }
            }
          } else {
            left = buttonRect.right + margin;
            if (left + listWidth + margin <= viewportWidth) {
              fitsHorizontally = true;
            } else {
              left = buttonRect.left - listWidth - margin;
              if (left >= margin) {
                fitsHorizontally = true;
              }
            }
          }
          if (fitsHorizontally) {
            top = buttonRect.top;
            if (top + listHeight + margin > viewportHeight) {
              top = Math.max(margin, viewportHeight - listHeight - margin);
            }
          } else {
            const besideLeft = buttonRect.left > screenHalf ? Math.max(margin, buttonRect.left - listWidth - margin) : Math.min(buttonRect.right + margin, viewportWidth - listWidth - margin);
            top = buttonRect.top - listHeight - margin;
            if (top >= margin) {
              left = besideLeft;
            } else {
              top = buttonRect.bottom + margin;
              left = besideLeft;
            }
          }
          left = Math.max(margin, Math.min(left, viewportWidth - listWidth - margin));
          const clampedViewportLeft = Math.max(margin, Math.min(left, viewportWidth - listWidth - margin));
          const relLeft = clampedViewportLeft - containerRect.left;
          const clampedViewportTop = Math.max(margin, Math.min(top, viewportHeight - listHeight - margin));
          const relTop = clampedViewportTop - containerRect.top;
          this.languageList.style.position = "absolute";
          this.languageList.style.left = `${relLeft}px`;
          this.languageList.style.top = `${relTop}px`;
        };
      }
      create() {
        this.remove();
        const { theme = "dark" } = this.options;
        const style = document.createElement("style");
        style.id = SELECTORS.DROPDOWN_STYLE;
        style.textContent = this.generateCSS(theme);
        document.head.appendChild(style);
        this.createContainer();
      }
      remove() {
        const existing = document.getElementById(SELECTORS.DROPDOWN_CONTAINER);
        if (existing) existing.remove();
        const style = document.getElementById(SELECTORS.DROPDOWN_STYLE);
        if (style) style.remove();
        document.removeEventListener("click", this.handleDocumentClick);
        window.removeEventListener("resize", this.handleResize);
        this.container = null;
        this.iconButton = null;
        this.languageList = null;
      }
      updateButtonLanguage() {
        if (!this.iconButton || !this.options.config) return;
        this.iconButton.innerHTML = "";
        const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgElement.setAttribute("width", "20px");
        svgElement.setAttribute("height", "20px");
        svgElement.setAttribute("viewBox", "0 0 24 24");
        svgElement.setAttribute("fill", "currentColor");
        svgElement.setAttribute("stroke", "currentColor");
        svgElement.innerHTML = `
              <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
              <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
              <g id="SVGRepo_iconCarrier">
                  <defs>
                      <style>.cls-1{fill:none;stroke:currentColor;stroke-miterlimit:10;stroke-width:1.92px;}</style>
                  </defs>
                  <line class="cls-1" x1="0.5" y1="3.35" x2="12" y2="3.35"></line>
                  <line class="cls-1" x1="6.25" y1="0.48" x2="6.25" y2="3.35"></line>
                  <path class="cls-1" d="M9.12,3.35c0,3.52-3.28,8.2-7.66,10.55"></path>
                  <path class="cls-1" d="M4.51,7.37A16.4,16.4,0,0,0,11,13.9"></path>
                  <polyline class="cls-1" points="12.96 22.52 16.79 11.98 17.75 11.98 21.58 22.52"></polyline>
                  <line class="cls-1" x1="20.43" y1="18.69" x2="15.07" y2="18.69"></line>
                  <line class="cls-1" x1="11.04" y1="22.52" x2="14.88" y2="22.52"></line>
                  <line class="cls-1" x1="19.67" y1="22.52" x2="23.5" y2="22.52"></line>
              </g>
          `;
        this.iconButton.appendChild(svgElement);
      }
      anchorContainerToPixels(x, y) {
        if (!this.container) return;
        this.container.style.left = `${x}px`;
        this.container.style.top = `${y}px`;
        this.container.style.right = "auto";
        this.container.style.bottom = "auto";
      }
      anchorContainerToBottomRight(right, bottom) {
        if (!this.container) return;
        this.container.style.left = "auto";
        this.container.style.top = "auto";
        this.container.style.right = `calc(${right}px + env(safe-area-inset-right, 0px))`;
        this.container.style.bottom = `calc(${bottom}px + env(safe-area-inset-bottom, 0px))`;
      }
      convertToPixelAnchor() {
        if (!this.container) return;
        if (!this.usingBottomRightAnchor) return;
        try {
          const rect = this.container.getBoundingClientRect();
          this.anchorContainerToPixels(rect.left, rect.top);
          this.isAnchored = true;
          this.usingBottomRightAnchor = false;
        } catch {
        }
      }
      update(newOptions) {
        this.options = { ...this.options, ...newOptions };
        this.updateButtonLanguage();
        if (this.languageList) {
          this.populateLanguageList();
        }
        if (this.iconButton) {
          if (this.options.disabled) {
            this.iconButton.disabled = true;
            this.iconButton.setAttribute("title", "Translation service unavailable");
            this.positionLanguageList();
          } else {
            this.iconButton.disabled = false;
            this.iconButton.removeAttribute("title");
            this.positionLanguageList();
          }
        }
      }
      generateCSS(theme) {
        const themeColors = getTranslatorThemeColors(theme);
        const isDark = theme === "dark";
        const thumbColor = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.2)";
        const thumbHoverColor = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.35)";
        const trackColor = themeColors.bg;
        return `
              #${SELECTORS.DROPDOWN_CONTAINER} {
                  position: var(--tl-position, fixed);
                  bottom: var(--tl-bottom, 24px);
                  bottom: calc(var(--tl-bottom, 24px) + env(safe-area-inset-bottom, 0px));
                  right: var(--tl-right, 24px);
                  right: calc(var(--tl-right, 24px) + env(safe-area-inset-right, 0px));
                  top: var(--tl-top, auto);
                  top: calc(var(--tl-top, auto) + env(safe-area-inset-top, 0px));
                  left: var(--tl-left, auto);
                  left: calc(var(--tl-left, auto) + env(safe-area-inset-left, 0px));
                  z-index: var(--tl-z-index, 2147483647) !important;
                  width: 50px;
                  height: 50px;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  background: transparent;
                  transition: none;
                  cursor: default;
                  font-family: var(--tl-font-family, 'Inter', sans-serif);
                  will-change: transform;
              }
  
              #${SELECTORS.DROPDOWN} {
                  width: 100%;
                  height: 100%;
                  border-radius: 50%;
                  background: var(--tl-bg, ${themeColors.bg});
                  border: var(--tl-border, ${themeColors.border});
                  box-shadow: var(--tl-box-shadow, ${themeColors.shadow});
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  cursor: pointer;
                  transition: transform 0.3s ease;
                  color: var(--tl-color, ${themeColors.color});
                  position: absolute;
                  top: 0;
                  left: 0;
                  z-index: 1;
                  font-family: var(--tl-font-family, 'Inter', sans-serif);
                  font-size: 12px;
                  font-weight: 500;
                  will-change: transform;
              }
  
              #${SELECTORS.DROPDOWN}:hover {
                  transform: scale(1.05);
              }
  
              #${SELECTORS.DROPDOWN}:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
              }
  
              #${SELECTORS.DROPDOWN_CONTAINER} .language-list {
                  display: none;
                  width: 200px;
                  max-height: 300px;
                  background: var(--tl-bg, ${themeColors.bg});
                  border-radius: 8px;
                  box-shadow: var(--tl-box-shadow, ${themeColors.shadow});
                  position: absolute;
                  z-index: 2147483648;
                  font-family: var(--tl-font-family, 'Inter', sans-serif);
                  flex-direction: column;
                  overflow: hidden;
              }
  
              #${SELECTORS.DROPDOWN_CONTAINER} .language-options-scroll {
                  overflow-y: auto;
                  flex: 1;
                  padding-top: 10px;
                  min-height: 50px;
                  scrollbar-width: thin;
                  scrollbar-color: var(--tl-scrollbar-thumb, ${thumbColor}) var(--tl-scrollbar-track, ${trackColor});
                  --tl-scrollbar-thumb: ${thumbColor};
                  --tl-scrollbar-thumb-hover: ${thumbHoverColor};
                  --tl-scrollbar-track: ${trackColor};
              }
  
              #${SELECTORS.DROPDOWN_CONTAINER}.expanded .language-list {
                  display: flex;
              }
  
              /* WebKit-based browsers (Chrome, Edge, Safari) */
              #${SELECTORS.DROPDOWN_CONTAINER} .language-options-scroll::-webkit-scrollbar {
                  width: 8px;
              }
              #${SELECTORS.DROPDOWN_CONTAINER} .language-options-scroll::-webkit-scrollbar-track {
                  background: var(--tl-scrollbar-track, ${trackColor});
              }
              #${SELECTORS.DROPDOWN_CONTAINER} .language-options-scroll::-webkit-scrollbar-thumb {
                  background-color: var(--tl-scrollbar-thumb, ${thumbColor});
                  border-radius: 8px;
                  border: 2px solid transparent;
              }
              #${SELECTORS.DROPDOWN_CONTAINER} .language-options-scroll::-webkit-scrollbar-thumb:hover {
                  background-color: var(--tl-scrollbar-thumb-hover, ${thumbHoverColor});
              }
  
              #${SELECTORS.DROPDOWN_CONTAINER} .language-list .language-option {
                  padding: var(--tl-option-padding, 8px 12px);
                  cursor: pointer;
                  transition: background-color 0.2s ease;
                  color: var(--tl-color, ${themeColors.color});
                  font-size: var(--tl-option-font-size, 12px);
                  font-weight: var(--tl-option-font-weight, 400);
                  font-family: var(--tl-option-font-family, var(--tl-font-family, 'Inter', sans-serif));
                  line-height: var(--tl-option-line-height, 1.3);
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
              }
              
              #${SELECTORS.DROPDOWN_CONTAINER} .language-list .language-option:hover {
                  background-color: var(--tl-bg-hover, ${themeColors.bgHover});
              }
              
              #${SELECTORS.DROPDOWN_CONTAINER} .language-list .language-option.selected {
                  background-color: var(--tl-selected-bg, rgba(0,0,0,0.1));
                  font-weight: bold;
              }
              
              #${SELECTORS.POWERED_BY} {
                  display: flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  gap: 6px !important;
                  
                  background: var(--tl-powered-bg, rgba(0,0,0,0.05)) !important;
                  border-top: 1px solid var(--tl-powered-border, rgba(0,0,0,0.1)) !important;
                  
                  font-size: 10px !important;
                  font-weight: 400 !important;
                  color: var(--tl-powered-color, #666) !important;
                  text-decoration: none !important;
                  line-height: 1 !important;
                  
                  padding: 6px 8px !important;
                  margin: 0 !important;
                  
                  cursor: pointer !important;
                  transition: background-color 0.2s ease !important;
                  
                  pointer-events: auto !important;
                  user-select: none !important;
                  -webkit-user-select: none !important;
                  -moz-user-select: none !important;
                  font-family: var(--tl-font-family, 'Inter', sans-serif) !important;
                  
                  width: 100% !important;
                  flex-shrink: 0 !important;
                  box-sizing: border-box !important;
              }
  
              #${SELECTORS.POWERED_BY}:hover {
                  background: var(--tl-powered-bg-hover, rgba(0,0,0,0.08)) !important;
              }
              
              #${SELECTORS.DROPDOWN_CONTAINER} .language-list .language-option.translation-status {
                  text-align: center;
                  font-style: italic;
                  padding-top: 12px;
                  color: var(--tl-color-muted, #888);
                  font-family: var(--tl-font-family, 'Inter', sans-serif);
              }
          `;
      }
      capitalizeLabel(label) {
        const escapeHtml = (unsafe) => {
          return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        };
        const escapedLabel = escapeHtml(label);
        const parts = escapedLabel.split("(");
        const beforeParen = parts[0].trim().split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
        if (parts.length === 1) return beforeParen;
        const insideParen = parts[1].replace(")", "").trim().split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
        return `${beforeParen} (${insideParen})`;
      }
      constrainToViewport(x, y) {
        if (!this.container) return { x, y };
        const dropdownWidth = this.container.offsetWidth;
        const dropdownHeight = this.container.offsetHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const minMargin = 24;
        let minY = minMargin;
        if (document.getElementById(CACHE_EDITOR_SELECTORS.EDIT_PILL)) {
          minY = Math.max(
            minY,
            EDIT_PILL_LAYOUT.VIEWPORT_MARGIN + EDIT_PILL_LAYOUT.GAP + dropdownHeight
          );
        }
        const maxX = viewportWidth - dropdownWidth - minMargin;
        const maxY = viewportHeight - dropdownHeight - minMargin;
        return {
          x: Math.max(minMargin, Math.min(x, maxX)),
          y: Math.max(minY, Math.min(y, maxY))
        };
      }
      restorePosition() {
        if (!this.container) return;
        const position = this.loadPosition();
        if (!position) return;
        if (position.anchor === "br") {
          const right = Math.max(24, position.x ?? 24);
          const bottom = Math.max(24, position.y ?? 24);
          this.anchorContainerToBottomRight(right, bottom);
          this.isAnchored = true;
          this.usingBottomRightAnchor = true;
          this.savePosition({ anchor: "br", x: right, y: bottom });
          return;
        }
        try {
          if (window.innerWidth <= 768) {
            return;
          }
        } catch {
        }
        if (typeof position.x === "number" && typeof position.y === "number") {
          const clamped = this.constrainToViewport(position.x, position.y);
          this.anchorContainerToPixels(clamped.x, clamped.y);
          this.isAnchored = true;
          this.usingBottomRightAnchor = false;
          this.savePosition({ x: clamped.x, y: clamped.y });
        }
      }
      // Local storage methods
      savePosition(position) {
        try {
          localStorage.setItem("camb_dropdown_position", JSON.stringify(position));
        } catch (error) {
          console.error("Failed to save dropdown position", error);
        }
      }
      loadPosition() {
        try {
          const positionStr = localStorage.getItem("camb_dropdown_position");
          return positionStr ? JSON.parse(positionStr) : null;
        } catch (error) {
          console.error("Failed to load dropdown position", error);
          return null;
        }
      }
      populateLanguageList() {
        if (!this.languageList) return;
        const { config, currentLang, translatedDropdownLabels = {} } = this.options;
        this.languageList.innerHTML = "";
        const scrollContainer = document.createElement("div");
        scrollContainer.classList.add("language-options-scroll");
        if (this.options.isTranslating || this.options.disabled) {
          const statusOption = document.createElement("div");
          statusOption.classList.add("language-option", "translation-status");
          statusOption.setAttribute("data-no-translate", "true");
          statusOption.textContent = this.options.isTranslating ? "Language being translated..." : "Translation service unavailable";
          statusOption.style.cursor = "default";
          statusOption.style.opacity = "0.6";
          statusOption.style.pointerEvents = "none";
          scrollContainer.appendChild(statusOption);
          this.languageList.appendChild(scrollContainer);
          const poweredByLink2 = this.createPoweredByLink();
          if (poweredByLink2) {
            this.languageList.appendChild(poweredByLink2);
          }
          return;
        }
        const sourceLanguage = config.defaultLang;
        const available = new Set([...config.targetLanguages, sourceLanguage].filter(Boolean));
        const availableLanguages = Array.from(available).filter((l) => config.languageLabels[l]);
        const allLanguages = [];
        const seoRoutingActive = usesSeoRouting(config.seoConfiguration);
        if (seoRoutingActive || currentLang === sourceLanguage) {
          if (sourceLanguage && config.languageLabels[sourceLanguage]) {
            allLanguages.push(sourceLanguage);
          }
          availableLanguages.forEach((l) => {
            if (l !== sourceLanguage) {
              allLanguages.push(l);
            }
          });
        } else if (sourceLanguage && config.languageLabels[sourceLanguage]) {
          allLanguages.push(sourceLanguage, currentLang);
        }
        allLanguages.forEach((l) => {
          const option = document.createElement("div");
          option.classList.add("language-option");
          option.setAttribute("data-lang", l);
          option.setAttribute("data-no-translate", "true");
          const rawLabel = translatedDropdownLabels[l] || config.languageLabels[l];
          const displayName = this.capitalizeLabel(rawLabel);
          option.textContent = displayName;
          if (l === currentLang) {
            option.classList.add("selected");
          }
          option.addEventListener("click", () => {
            var _a, _b;
            (_b = (_a = this.options).onLanguageChange) == null ? void 0 : _b.call(_a, l);
            this.toggleLanguageList(new MouseEvent("click"));
          });
          scrollContainer.appendChild(option);
        });
        this.languageList.appendChild(scrollContainer);
        const poweredByLink = this.createPoweredByLink();
        if (poweredByLink) {
          this.languageList.appendChild(poweredByLink);
        }
      }
      createPoweredByLink() {
        const poweredBy = document.createElement("a");
        poweredBy.id = SELECTORS.POWERED_BY;
        poweredBy.href = "https://camb.ai";
        poweredBy.target = "_blank";
        poweredBy.rel = "noopener noreferrer";
        poweredBy.setAttribute("data-no-translate", "true");
        const text = document.createElement("span");
        text.textContent = "Powered by CAMB.AI";
        text.setAttribute("data-no-translate", "true");
        poweredBy.appendChild(text);
        return poweredBy;
      }
      createContainer() {
        this.container = document.createElement("div");
        this.container.id = SELECTORS.DROPDOWN_CONTAINER;
        this.container.setAttribute("data-no-translate", "true");
        this.container.style.position = "fixed";
        this.container.style.cursor = "default";
        this.container.style.transition = "none";
        this.iconButton = document.createElement("button");
        this.iconButton.id = SELECTORS.DROPDOWN;
        this.iconButton.setAttribute("data-no-translate", "true");
        this.iconButton.style.position = "absolute";
        this.iconButton.style.top = "0";
        this.iconButton.style.left = "0";
        this.iconButton.style.width = "100%";
        this.iconButton.style.height = "100%";
        this.iconButton.style.background = "var(--tl-bg, #333333)";
        this.iconButton.style.border = "var(--tl-border, none)";
        this.iconButton.style.borderRadius = "50%";
        this.iconButton.style.color = "var(--tl-color, #ffffff)";
        this.iconButton.style.cursor = "pointer";
        this.iconButton.style.display = "flex";
        this.iconButton.style.alignItems = "center";
        this.iconButton.style.justifyContent = "center";
        this.iconButton.style.boxShadow = "var(--tl-box-shadow, 0 2px 8px rgba(0,0,0,0.3))";
        this.iconButton.style.transition = "transform 0.3s ease";
        const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgElement.setAttribute("width", "20px");
        svgElement.setAttribute("height", "20px");
        svgElement.setAttribute("viewBox", "0 0 24 24");
        svgElement.setAttribute("fill", "currentColor");
        svgElement.setAttribute("stroke", "currentColor");
        svgElement.innerHTML = `
              <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
              <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
              <g id="SVGRepo_iconCarrier">
                  <defs>
                      <style>.cls-1{fill:none;stroke:currentColor;stroke-miterlimit:10;stroke-width:1.92px;}</style>
                  </defs>
                  <line class="cls-1" x1="0.5" y1="3.35" x2="12" y2="3.35"></line>
                  <line class="cls-1" x1="6.25" y1="0.48" x2="6.25" y2="3.35"></line>
                  <path class="cls-1" d="M9.12,3.35c0,3.52-3.28,8.2-7.66,10.55"></path>
                  <path class="cls-1" d="M4.51,7.37A16.4,16.4,0,0,0,11,13.9"></path>
                  <polyline class="cls-1" points="12.96 22.52 16.79 11.98 17.75 11.98 21.58 22.52"></polyline>
                  <line class="cls-1" x1="20.43" y1="18.69" x2="15.07" y2="18.69"></line>
                  <line class="cls-1" x1="11.04" y1="22.52" x2="14.88" y2="22.52"></line>
                  <line class="cls-1" x1="19.67" y1="22.52" x2="23.5" y2="22.52"></line>
              </g>
          `;
        const iconWrapper = document.createElement("div");
        iconWrapper.style.width = "100%";
        iconWrapper.style.height = "100%";
        iconWrapper.style.position = "relative";
        iconWrapper.style.display = "flex";
        iconWrapper.style.alignItems = "center";
        iconWrapper.style.justifyContent = "center";
        this.iconButton.appendChild(svgElement);
        iconWrapper.appendChild(this.iconButton);
        this.iconButton.addEventListener("mousedown", this.handleMouseDown);
        this.iconButton.addEventListener("touchstart", this.handleTouchStart, { passive: false });
        this.iconButton.addEventListener("click", (e) => {
          if (this.didDrag) {
            e.preventDefault();
            e.stopPropagation();
            this.didDrag = false;
            return;
          }
          this.toggleLanguageList(e);
        });
        this.languageList = document.createElement("div");
        this.languageList.classList.add("language-list");
        this.populateLanguageList();
        this.container.appendChild(iconWrapper);
        this.container.appendChild(this.languageList);
        if (this.iconButton && this.options.disabled) {
          this.iconButton.disabled = true;
          this.iconButton.setAttribute("title", "Translation service unavailable");
        }
        document.body.appendChild(this.container);
        this.prevViewportWidth = window.innerWidth;
        this.prevViewportHeight = window.innerHeight;
        this.restorePosition();
        document.addEventListener("click", this.handleDocumentClick);
        window.addEventListener("resize", this.handleResize);
      }
    }
    class TranslationObserver {
      constructor(onUrlChange, onContentChange, configManager) {
        this.onUrlChange = onUrlChange;
        this.onContentChange = onContentChange;
        this.configManager = configManager;
        this.observer = null;
        this.currentUrl = "";
      }
      start() {
        this.stop();
        this.currentUrl = DomUtils.getCurrentPath();
        this.observer = new MutationObserver((mutations) => {
          if (window.__isTranslatingDOM) return;
          const newUrl = DomUtils.getCurrentPath();
          if (newUrl !== this.currentUrl) {
            this.currentUrl = newUrl;
            this.onUrlChange(newUrl);
            return;
          }
          this.processMutations(mutations);
        });
        const observeOptions = {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: [...TRANSLATABLE_ATTRIBUTES]
        };
        this.observer.observe(document.body, observeOptions);
        this.observeOpenShadowRoots(document.body, observeOptions);
        this.patchAttachShadow(observeOptions);
      }
      stop() {
        var _a;
        (_a = this.observer) == null ? void 0 : _a.disconnect();
        this.observer = null;
      }
      processMutations(mutations) {
        var _a, _b;
        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            if (mutation.addedNodes.length > 0 && mutation.removedNodes.length === 1) {
              const twin = mutation.removedNodes[0];
              if (twin.nodeType === 1 && twin.hasAttribute(ATTRIBUTES.SOURCE_TEXT)) {
                mutation.addedNodes.forEach((node) => {
                  if (node.nodeType === 1) {
                    const el = node;
                    if (!el.hasAttribute(ATTRIBUTES.SOURCE_TEXT)) {
                      el.setAttribute(
                        ATTRIBUTES.SOURCE_TEXT,
                        twin.getAttribute(ATTRIBUTES.SOURCE_TEXT)
                      );
                      const translatedTo = twin.getAttribute(ATTRIBUTES.TRANSLATED_TO);
                      if (translatedTo) {
                        el.setAttribute(ATTRIBUTES.TRANSLATED_TO, translatedTo);
                      }
                      for (let i = 0; i < twin.attributes.length; i++) {
                        const attr = twin.attributes[i];
                        if (attr.name.startsWith(ATTRIBUTES.SOURCE_ATTRIBUTE_PREFIX)) {
                          if (!el.hasAttribute(attr.name)) {
                            el.setAttribute(attr.name, attr.value);
                          }
                        }
                      }
                    }
                  }
                });
              }
            }
            mutation.addedNodes.forEach((node) => {
              if (this.isTranslatableElement(node) && !queued.has(node) && !translated.has(node)) {
                this.onContentChange(node);
              }
            });
          } else if (mutation.type === "characterData") {
            const textNode = mutation.target;
            const parent = mutation.target.parentElement;
            if (!parent) continue;
            const translationState = parent.getAttribute(ATTRIBUTES.TRANSLATION_STATE);
            const translatedTo = parent.getAttribute(ATTRIBUTES.TRANSLATED_TO);
            const currentLang = this.configManager.getCurrentLanguage();
            if (translationState === "translated" || translatedTo === currentLang) {
              const stored = getTranslatedText(textNode);
              const current = ((_a = mutation.target.data) == null ? void 0 : _a.trim()) || "";
              if (stored !== void 0 && stored !== current) {
                parent.setAttribute(ATTRIBUTES.SOURCE_TEXT, mutation.target.data || "");
                clearTranslatedText(textNode);
                translated.delete(textNode);
                parent.removeAttribute(ATTRIBUTES.TRANSLATION_STATE);
                parent.removeAttribute(ATTRIBUTES.TRANSLATED_TO);
                if (!queued.has(parent)) {
                  this.onContentChange(parent);
                }
                continue;
              }
            }
            if (this.isTranslatableElement(parent) && !queued.has(parent) && !translated.has(parent)) {
              this.onContentChange(parent);
            }
          } else if (mutation.type === "attributes") {
            const element = mutation.target;
            const attrName = mutation.attributeName || "";
            const translationState = element.getAttribute(ATTRIBUTES.TRANSLATION_STATE);
            const translatedTo = element.getAttribute(ATTRIBUTES.TRANSLATED_TO);
            const currentLang = this.configManager.getCurrentLanguage();
            if ((translationState === "translated" || translatedTo === currentLang) && attrName) {
              const storedAttr = getTranslatedAttribute(element, attrName);
              const currentVal = ((_b = element.getAttribute(attrName)) == null ? void 0 : _b.trim()) || "";
              if (storedAttr !== void 0 && storedAttr !== currentVal) {
                const sourceAttributeName = `${ATTRIBUTES.SOURCE_ATTRIBUTE_PREFIX}${attrName}`;
                element.setAttribute(sourceAttributeName, element.getAttribute(attrName) || "");
                clearTranslatedAttribute(element, attrName);
                translated.delete(element);
                element.removeAttribute(ATTRIBUTES.TRANSLATION_STATE);
                element.removeAttribute(ATTRIBUTES.TRANSLATED_TO);
                if (!queued.has(element)) {
                  this.onContentChange(element);
                }
                continue;
              }
            }
            if (element && this.isTranslatableElement(element) && !queued.has(element) && !translated.has(element)) {
              this.onContentChange(element);
            }
          }
        }
      }
      isTranslatableElement(node) {
        if (node.nodeType !== 1) return false;
        const element = node;
        if (element.tagName === "p") return true;
        if (element.tagName === "span") return true;
        const translationState = element.getAttribute(ATTRIBUTES.TRANSLATION_STATE);
        if (translationState === "translating" || translationState === "translated") {
          return false;
        }
        if (element.matches(DROPDOWN_EXCLUDED_SELECTORS.join(", "))) return false;
        if (DomUtils.shouldPreventTranslation(element)) return false;
        if (DomUtils.isNonContentElement(element)) return false;
        const currentLang = this.configManager.getCurrentLanguage();
        if (element.getAttribute(ATTRIBUTES.TRANSLATED_TO) === currentLang) {
          element.removeAttribute(ATTRIBUTES.TRANSLATED_TO);
        }
        return true;
      }
      observeOpenShadowRoots(root, options) {
        if (!this.observer) return;
        const base = root === document ? document.body : root;
        if (root.shadowRoot) {
          const sr = root.shadowRoot;
          try {
            this.observer.observe(sr, options);
          } catch {
          }
        }
        const walker = document.createTreeWalker(base, NodeFilter.SHOW_ELEMENT);
        let node;
        while (node = walker.nextNode()) {
          const el = node;
          const sr = el.shadowRoot;
          if (sr) {
            try {
              this.observer.observe(sr, options);
            } catch {
            }
            this.observeOpenShadowRoots(sr, options);
          }
        }
      }
      patchAttachShadow(options) {
        if (window.__tlAttachShadowPatched) return;
        const original = Element.prototype.attachShadow;
        const self = this;
        try {
          Element.prototype.attachShadow = function(init) {
            const sr = original.call(this, init);
            try {
              if (init && init.mode === "open" && self.observer) {
                self.observer.observe(sr, options);
              }
            } catch {
            }
            return sr;
          };
          window.__tlAttachShadowPatched = true;
        } catch {
        }
      }
    }
    class TextExtractor {
      static extractFromElement(root, shouldCheckUnwantedContent) {
        return this.extractWithLanguageFilter(root, shouldCheckUnwantedContent);
      }
      static extractFreshContentForLanguage(root, targetLanguage, shouldCheckUnwantedContent) {
        return this.extractWithLanguageFilter(root, shouldCheckUnwantedContent, targetLanguage);
      }
      static extractWithLanguageFilter(root, _shouldCheckUnwantedContent, targetLanguage) {
        const textNodes = [];
        const nodeMap = /* @__PURE__ */ new Map();
        const attributeTexts = [];
        const attributeMap = /* @__PURE__ */ new Map();
        let textIndex = 0;
        let attributeIndex = 0;
        const translatableAttributeSelector = TRANSLATABLE_ATTRIBUTES.map((attr) => `[${attr}]`).join(",");
        const acceptTextNode = (node) => {
          var _a;
          const text = (_a = node.textContent) == null ? void 0 : _a.trim();
          const parent = node.parentNode;
          if (!text || text.length === 0) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent && DomUtils.shouldPreventTranslation(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent && DomUtils.isNonContentElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (this.isNumberLike(text)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (this.isPureSpecialCharacter(text)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (targetLanguage && parent) {
            const translatedTo = parent.getAttribute(ATTRIBUTES.TRANSLATED_TO);
            if (translatedTo === targetLanguage) {
              return NodeFilter.FILTER_REJECT;
            }
          }
          return NodeFilter.FILTER_ACCEPT;
        };
        const processContainer = (container) => {
          const base = container === document ? document.body : container;
          if (container.shadowRoot) {
            const sr = container.shadowRoot;
            processContainer(sr);
          }
          const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT, {
            acceptNode: acceptTextNode
          });
          let node;
          while (node = walker.nextNode()) {
            const parent = node.parentElement;
            if (!parent) continue;
            const sourceText = parent.hasAttribute(ATTRIBUTES.SOURCE_TEXT) ? parent.getAttribute(ATTRIBUTES.SOURCE_TEXT) : node.textContent;
            textNodes.push(sourceText);
            nodeMap.set(textIndex, {
              node,
              parent,
              sourceText
            });
            textIndex++;
          }
          const elementsWithAttributes = Array.from(
            base.querySelectorAll(translatableAttributeSelector)
          );
          elementsWithAttributes.forEach((element) => {
            if (DomUtils.shouldPreventTranslation(element)) {
              return;
            }
            if (DomUtils.isNonContentElement(element)) {
              return;
            }
            if (targetLanguage && element.getAttribute(ATTRIBUTES.TRANSLATED_TO) === targetLanguage) {
              return;
            }
            TRANSLATABLE_ATTRIBUTES.forEach((attr) => {
              const value = element.getAttribute(attr);
              if (value && value.trim()) {
                const sourceAttribute = `${ATTRIBUTES.SOURCE_ATTRIBUTE_PREFIX}${attr}`;
                if (element.hasAttribute(sourceAttribute)) {
                  attributeTexts.push(element.getAttribute(sourceAttribute));
                } else {
                  attributeTexts.push(value);
                }
                attributeMap.set(attributeIndex, {
                  element,
                  attribute: attr
                });
                attributeIndex++;
              }
            });
          });
          const elementWalker = document.createTreeWalker(base, NodeFilter.SHOW_ELEMENT);
          let elNode;
          while (elNode = elementWalker.nextNode()) {
            const el = elNode;
            const sr = el.shadowRoot;
            if (sr) {
              processContainer(sr);
            }
          }
        };
        processContainer(root);
        return { textNodes, nodeMap, attributeTexts, attributeMap };
      }
      static isJsonString(text) {
        try {
          JSON.parse(text);
          return true;
        } catch {
          return false;
        }
      }
      static isUnwantedContent(_text) {
        return false;
      }
      static isPureSpecialCharacter(text) {
        const specialCharsRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]+/;
        return specialCharsRegex.test(text) && !text.match(/[a-zA-Z0-9\s]/);
      }
      static isNumberLike(text) {
        const t = text.trim();
        if (!t) return false;
        if (/[A-Za-z]/.test(t)) return false;
        const allowedCharsRegex = /[0-9\s.,+\-:;/()%$€£₹]/g;
        const stripped = t.replace(allowedCharsRegex, "");
        return /[0-9]/.test(t) && stripped.length === 0;
      }
    }
    class DebouncedSender {
      constructor(sendFn, delay = 70, concurrencyLimit = 4) {
        this.sendFn = sendFn;
        this.delay = delay;
        this.concurrencyLimit = concurrencyLimit;
        this.pending = /* @__PURE__ */ new Set();
        this.requestQueue = [];
        this.activeRequests = 0;
      }
      clear() {
        clearTimeout(this.timerId);
        this.timerId = void 0;
        this.pending.clear();
        for (const payload of this.requestQueue) {
          payload.textMap.forEach((target) => queued.delete(target.node));
          payload.attributeMap.forEach(({ element }) => queued.delete(element));
        }
        this.requestQueue = [];
      }
      enqueue(el) {
        if (queued.has(el) || translated.has(el)) {
          return;
        }
        this.pending.add(el);
        if (this.timerId) {
          clearTimeout(this.timerId);
        }
        this.timerId = window.setTimeout(() => this.flush(), this.delay);
      }
      flush() {
        if (this.pending.size === 0) return;
        const elems = Array.from(this.pending);
        this.pending.clear();
        this.timerId = void 0;
        const payload = collectUniqueContent(elems);
        if (payload.texts.length === 0 && payload.attributeTexts.length === 0) return;
        this.requestQueue.push(payload);
        this.processQueue();
      }
      processQueue() {
        if (this.activeRequests >= this.concurrencyLimit || this.requestQueue.length === 0) {
          return;
        }
        this.activeRequests++;
        const payload = this.requestQueue.shift();
        payload.textMap.forEach((target) => queued.add(target.node));
        payload.attributeMap.forEach(({ element }) => queued.add(element));
        this.sendFn(payload).catch((err) => {
          console.error("DebouncedSender sendFn error:", err);
          payload.textMap.forEach((target) => queued.delete(target.node));
          payload.attributeMap.forEach(({ element }) => queued.delete(element));
        }).finally(() => {
          this.activeRequests--;
          this.processQueue();
        });
      }
    }
    function collectUniqueContent(elems) {
      const texts = [];
      const textMap = /* @__PURE__ */ new Map();
      const attributeTexts = [];
      const attributeMap = /* @__PURE__ */ new Map();
      let textIdx = 0;
      let attrIdx = 0;
      elems.forEach((el) => {
        const {
          textNodes,
          nodeMap,
          attributeTexts: elemAttrTexts,
          attributeMap: elemAttrMap
        } = TextExtractor.extractFreshContentForLanguage(
          el,
          document.documentElement.lang,
          (text) => TextExtractor.isJsonString(text) || TextExtractor.isUnwantedContent(text)
        );
        textNodes.forEach((txt, localIdx) => {
          const target = nodeMap.get(localIdx);
          if (!target) return;
          if (queued.has(target.node) || translated.has(target.node)) return;
          texts.push(txt);
          textMap.set(textIdx++, target);
        });
        elemAttrTexts.forEach((txt, localIdx) => {
          const attrInfo = elemAttrMap.get(localIdx);
          if (!attrInfo) return;
          if (queued.has(attrInfo.element) || translated.has(attrInfo.element)) return;
          attributeTexts.push(txt);
          attributeMap.set(attrIdx++, attrInfo);
        });
      });
      return { texts, textMap, attributeTexts, attributeMap };
    }
    class NavigationService {
      constructor() {
        this.handler = null;
        this.debounceTimer = null;
        this.isListening = false;
        this.originalPushState = null;
        this.originalReplaceState = null;
        this.onRouteChange = () => {
          this.clearDebounce();
          this.debounceTimer = window.setTimeout(() => {
            if (this.handler) {
              const currentUrl = window.location.pathname + window.location.search;
              this.handler(currentUrl);
            }
          }, TIMINGS.SPA_NAVIGATION_DEBOUNCE);
        };
      }
      setHandler(handler) {
        this.handler = handler;
      }
      start() {
        if (this.isListening) return;
        this.isListening = true;
        this.hookHistoryAPI();
        this.addPopstateListener();
      }
      stop() {
        if (!this.isListening) return;
        this.isListening = false;
        this.unhookHistoryAPI();
        this.removePopstateListener();
        this.clearDebounce();
      }
      hookHistoryAPI() {
        this.originalPushState = history.pushState.bind(history);
        this.originalReplaceState = history.replaceState.bind(history);
        history.pushState = (...args) => {
          const result = this.originalPushState.apply(history, args);
          this.onRouteChange();
          return result;
        };
        history.replaceState = (...args) => {
          const result = this.originalReplaceState.apply(history, args);
          this.onRouteChange();
          return result;
        };
      }
      unhookHistoryAPI() {
        if (this.originalPushState) {
          history.pushState = this.originalPushState;
          this.originalPushState = null;
        }
        if (this.originalReplaceState) {
          history.replaceState = this.originalReplaceState;
          this.originalReplaceState = null;
        }
      }
      addPopstateListener() {
        window.addEventListener("popstate", this.onRouteChange);
      }
      removePopstateListener() {
        window.removeEventListener("popstate", this.onRouteChange);
      }
      clearDebounce() {
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
      }
    }
    class PageContextCollector {
      static collectPageContext() {
        var _a, _b;
        const context = {};
        const title = (_a = document.title) == null ? void 0 : _a.trim();
        if (title && title.length > 0) {
          context.title = title;
        }
        const descriptionMeta = document.querySelector('meta[name="description"]');
        const description = (_b = descriptionMeta == null ? void 0 : descriptionMeta.content) == null ? void 0 : _b.trim();
        if (description && description.length > 0) {
          context.description = description;
        }
        context.url = window.location.pathname + window.location.search;
        return context;
      }
    }
    class MetadataUtils {
      static collectMetadata() {
        var _a, _b;
        const list = [];
        const title = (_a = document.title) == null ? void 0 : _a.trim();
        if (title) {
          list.push(["title", title]);
        }
        const desc = document.querySelector('meta[name="description"]');
        const descContent = (_b = desc == null ? void 0 : desc.content) == null ? void 0 : _b.trim();
        if (descContent) {
          list.push(["description", descContent]);
        }
        return list;
      }
      static applyMetadata(translated2, targetLang) {
        translated2.forEach(([key, val]) => {
          if (key === "title") {
            document.title = val;
          } else if (key === "description") {
            const meta = document.querySelector('meta[name="description"]');
            if (meta) {
              meta.content = val;
            }
          }
        });
        document.documentElement.setAttribute(ATTRIBUTES.TRANSLATED_TO, targetLang);
      }
    }
    function buildDropdownLabelPayload(config) {
      const allLangs = /* @__PURE__ */ new Set([...config.targetLanguages, config.defaultLang]);
      const keys = Array.from(allLangs).filter((key) => config.languageLabels[key]);
      return { keys, labels: keys.map((key) => config.languageLabels[key]) };
    }
    function mapTranslatedDropdownLabels(keys, translated2) {
      const map = {};
      keys.forEach((key, index) => {
        if (translated2[index]) {
          map[key] = translated2[index];
        }
      });
      return map;
    }
    class SkeletonManager {
      static apply(node) {
        var _a;
        if (node.nodeType !== Node.TEXT_NODE || !((_a = node.textContent) == null ? void 0 : _a.trim())) {
          return null;
        }
        const parent = node.parentElement;
        if (!parent || DomUtils.isNonContentElement(parent) || DomUtils.shouldPreventTranslation(parent)) {
          return null;
        }
        const wrapper = document.createElement("span");
        wrapper.className = "tl-skeleton";
        const bgColor = this.findInheritedBackgroundColor(parent);
        const hexColor = this.rgbToHex(bgColor);
        const skeletonBgColor = this.adjustColorBrightness(hexColor, -5);
        const skeletonHighlightColor = this.adjustColorBrightness(hexColor, 10);
        wrapper.style.setProperty("--skeleton-bg-color", skeletonBgColor);
        wrapper.style.setProperty("--skeleton-highlight-color", skeletonHighlightColor);
        if (node.parentNode) {
          node.parentNode.insertBefore(wrapper, node);
          wrapper.appendChild(node);
        }
        return wrapper;
      }
      static remove(skeletonWrapper) {
        if (!skeletonWrapper || !skeletonWrapper.parentNode) return;
        const originalNode = skeletonWrapper.firstChild;
        if (originalNode) {
          skeletonWrapper.parentNode.insertBefore(originalNode, skeletonWrapper);
        }
        skeletonWrapper.remove();
      }
      static findInheritedBackgroundColor(element) {
        let current = element;
        while (current) {
          const color = window.getComputedStyle(current).backgroundColor;
          if (color && color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
            return color;
          }
          if (current === document.body) break;
          current = current.parentElement;
        }
        return window.getComputedStyle(document.documentElement).backgroundColor || "#65737e";
      }
      static rgbToHex(rgb) {
        const result = rgb.match(/\d+/g);
        if (!result) return "#e0e0e0";
        return "#" + result.slice(0, 3).map((x) => ("0" + parseInt(x).toString(16)).slice(-2)).join("");
      }
      static adjustColorBrightness(hex, percent) {
        const num = parseInt(hex.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 255) + amt;
        const B = (num & 255) + amt;
        return "#" + (16777216 + (this.clamp(R, 0, 255) << 16) + (this.clamp(G, 0, 255) << 8) + this.clamp(B, 0, 255)).toString(16).slice(1);
      }
      static clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
      }
    }
    class TranslatorAPI {
      constructor(initialization, snapshot, change) {
        this.change = change;
        this.currentLang = "";
        this.supportedLanguages = [];
        this.state = "initializing";
        this.revision = 0;
        this.tail = Promise.resolve();
        this.languageListeners = /* @__PURE__ */ new Set();
        this.statusListeners = /* @__PURE__ */ new Set();
        this.ready = initialization.then(() => {
          const initial = snapshot();
          this.currentLang = initial.currentLang;
          this.supportedLanguages = [...new Set(initial.languages)];
          this.report("ready");
          for (const listener of this.languageListeners) this.notify(() => listener(this.currentLang));
        }).catch((error) => {
          this.report("failed", error);
          throw error;
        });
        void this.ready.catch(() => {
        });
      }
      get languages() {
        return [...this.supportedLanguages];
      }
      onLanguageChange(listener) {
        this.languageListeners.add(listener);
        return () => {
          this.languageListeners.delete(listener);
        };
      }
      onStatusChange(listener) {
        this.statusListeners.add(listener);
        return () => {
          this.statusListeners.delete(listener);
        };
      }
      report(state, error) {
        this.state = state;
        const event = { state, language: this.currentLang };
        if (error) event.error = error instanceof Error ? error.message : String(error);
        for (const listener of this.statusListeners) this.notify(() => listener(event));
      }
      async switchLanguage(language2) {
        await this.ready;
        if (!this.supportedLanguages.includes(language2)) throw new Error(`Unsupported language: ${language2}`);
        const revision = ++this.revision;
        this.currentLang = language2;
        for (const listener of this.languageListeners) this.notify(() => listener(language2));
        this.report("translating");
        const operation = this.tail.catch(() => {
        }).then(async () => {
          if (revision !== this.revision) return { language: language2, status: "superseded" };
          try {
            const status = await this.change(language2);
            if (revision !== this.revision) return { language: language2, status: "superseded" };
            this.report(status === "reloading" ? "reloading" : "ready");
            return { language: language2, status };
          } catch (error) {
            if (revision === this.revision) this.report("error", error);
            throw error;
          }
        });
        this.tail = operation;
        return operation;
      }
      notify(callback) {
        try {
          callback();
        } catch (error) {
          console.error("Translator subscriber failed:", error);
        }
      }
    }
    const CHANNEL = "website-translator";
    const VERSION = 1;
    const token = (value) => typeof value === "string" && value.length > 0 && value.length <= 128;
    const language = (value) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,34}$/.test(value);
    function exactOrigin(origin) {
      const url = new URL(origin);
      if (!["https:", "http:"].includes(url.protocol) || url.origin !== origin) throw new Error("An exact HTTP(S) origin is required");
      return origin;
    }
    function isSyncMessage(value) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const m = value;
      if (m.channel !== CHANNEL || m.version !== VERSION) return false;
      if (m.type === "probe") return token(m.connection);
      if (!token(m.session)) return false;
      if (m.type === "ready") return (m.connection === void 0 || token(m.connection)) && Array.isArray(m.languages) && m.languages.length > 0 && m.languages.length <= 200 && m.languages.every(language);
      if (m.type === "failed") return (m.connection === void 0 || token(m.connection)) && typeof m.error === "string" && m.error.length <= 500;
      if (!token(m.connection) || !Number.isSafeInteger(m.revision) || m.revision < 0 || !language(m.language)) return false;
      if (m.type === "set") return true;
      return m.type === "status" && ["complete", "error", "reloading"].includes(m.state) && (m.error === void 0 || typeof m.error === "string" && m.error.length <= 500);
    }
    function send(target, origin, message) {
      target.postMessage({ channel: CHANNEL, version: VERSION, ...message }, origin);
    }
    const errorText = (error) => (error instanceof Error ? error.message : String(error)).slice(0, 500);
    let activeParent;
    let activeChild;
    function connectParent(options) {
      options.frames.forEach((frame) => {
        var _a;
        exactOrigin(frame.origin);
        (_a = frame.allowedOrigins) == null ? void 0 : _a.forEach(exactOrigin);
        if (frame.allowedOrigins && !frame.allowedOrigins.includes(frame.origin)) throw new Error("Frame origin must be in its allowed origins");
      });
      activeParent == null ? void 0 : activeParent.destroy();
      const { translator } = options;
      let revision = 0;
      let enabled = true;
      let destroyed = false;
      let initialized = false;
      const frames = /* @__PURE__ */ new Map();
      const status = (iframe, state, error) => {
        var _a;
        if (destroyed) return;
        try {
          (_a = options.onStatus) == null ? void 0 : _a.call(options, { iframe, state, language: translator.currentLang, error });
        } catch (e) {
          console.error("Iframe status subscriber failed:", e);
        }
      };
      const deadline = (iframe) => {
        const frame = frames.get(iframe);
        clearTimeout(frame.timer);
        frame.timer = window.setTimeout(() => status(iframe, "failed", "No synchronization acknowledgement before deadline"), options.timeoutMs ?? 2e4);
      };
      const update = (iframe) => {
        var _a;
        const frame = frames.get(iframe);
        if (!enabled || !initialized || !frame.session || !iframe.contentWindow) return;
        if (!((_a = frame.languages) == null ? void 0 : _a.includes(translator.currentLang))) {
          clearTimeout(frame.timer);
          status(iframe, "failed", `Iframe does not support ${translator.currentLang}`);
          return;
        }
        status(iframe, "translating");
        deadline(iframe);
        send(iframe.contentWindow, frame.origin, { type: "set", session: frame.session, connection: frame.connection, revision, language: translator.currentLang });
      };
      const probe = (iframe) => {
        const frame = frames.get(iframe);
        if (!enabled || !iframe.contentWindow) return;
        frame.session = void 0;
        frame.languages = void 0;
        frame.connection = crypto.randomUUID();
        status(iframe, "waiting");
        deadline(iframe);
        for (const origin of frame.allowedOrigins) send(iframe.contentWindow, origin, { type: "probe", connection: frame.connection });
      };
      const listener = (event) => {
        if (!enabled || destroyed || !isSyncMessage(event.data)) return;
        const entry = [...frames].find(([iframe2, frame2]) => event.source === iframe2.contentWindow && frame2.allowedOrigins.includes(event.origin));
        if (!entry) return;
        const [iframe, frame] = entry;
        const message = event.data;
        if (message.type === "ready" || message.type === "failed") {
          if (!message.connection) {
            if (iframe.contentWindow) send(iframe.contentWindow, event.origin, { type: "probe", connection: frame.connection });
            return;
          }
          if (message.connection !== frame.connection) return;
          frame.origin = event.origin;
        }
        if (message.type === "ready") {
          const duplicate = frame.session === message.session;
          frame.session = message.session;
          frame.languages = message.languages;
          if (!duplicate) update(iframe);
        } else if (message.type === "failed") {
          clearTimeout(frame.timer);
          status(iframe, "failed", message.error);
        } else if (message.type === "status" && event.origin === frame.origin && message.session === frame.session && message.connection === frame.connection && message.revision === revision && message.language === translator.currentLang) {
          clearTimeout(frame.timer);
          status(iframe, message.state === "complete" ? "ready" : message.state === "reloading" ? "reloading" : "failed", message.error);
        }
      };
      window.addEventListener("message", listener);
      const unsubscribe = translator.onLanguageChange(() => {
        ++revision;
        for (const iframe of frames.keys()) update(iframe);
      });
      const bridge = {
        addFrame({ iframe, origin, allowedOrigins = [origin] }) {
          exactOrigin(origin);
          allowedOrigins.forEach(exactOrigin);
          if (!allowedOrigins.includes(origin)) throw new Error("Frame origin must be in its allowed origins");
          if (destroyed) throw new Error("Connection destroyed");
          const previous = frames.get(iframe);
          if (previous) {
            iframe.removeEventListener("load", previous.load);
            clearTimeout(previous.timer);
          }
          const frame = { origin, allowedOrigins: [...new Set(allowedOrigins)], connection: crypto.randomUUID(), load: () => probe(iframe), session: void 0, languages: void 0, timer: void 0 };
          frames.set(iframe, frame);
          iframe.addEventListener("load", frame.load);
          probe(iframe);
          return () => {
            if (frames.get(iframe) !== frame) return;
            iframe.removeEventListener("load", frame.load);
            clearTimeout(frame.timer);
            frames.delete(iframe);
          };
        },
        setEnabled(value) {
          if (destroyed || value === enabled) return;
          enabled = value;
          ++revision;
          for (const [iframe, frame] of frames) {
            clearTimeout(frame.timer);
            if (enabled) probe(iframe);
            else status(iframe, "disabled");
          }
        },
        destroy() {
          if (destroyed) return;
          destroyed = true;
          unsubscribe();
          window.removeEventListener("message", listener);
          for (const [iframe, frame] of frames) {
            clearTimeout(frame.timer);
            iframe.removeEventListener("load", frame.load);
          }
          frames.clear();
          if (activeParent === bridge) activeParent = void 0;
        }
      };
      activeParent = bridge;
      options.frames.forEach((frame) => bridge.addFrame(frame));
      void translator.ready.then(() => {
        if (destroyed) return;
        initialized = true;
        for (const iframe of frames.keys()) update(iframe);
      }, (error) => {
        for (const [iframe, frame] of frames) {
          clearTimeout(frame.timer);
          status(iframe, "failed", errorText(error));
        }
      });
      return bridge;
    }
    function connectIframe({ translator, parentOrigin }) {
      exactOrigin(parentOrigin);
      activeChild == null ? void 0 : activeChild.destroy();
      const session = crypto.randomUUID();
      let destroyed = false;
      let currentConnection = "";
      let latestRevision = -1;
      let latestLanguage = "";
      const announce = () => {
        if (destroyed || window.parent === window) return;
        void translator.ready.then(() => {
          if (!destroyed) send(window.parent, parentOrigin, { type: "ready", session, connection: currentConnection || void 0, languages: translator.languages });
        }, (error) => {
          if (!destroyed) send(window.parent, parentOrigin, { type: "failed", session, connection: currentConnection || void 0, error: errorText(error) });
        });
      };
      const reply = (state, connection, revision, language2, error) => {
        if (!destroyed && connection === currentConnection && revision === latestRevision) send(window.parent, parentOrigin, { type: "status", session, connection, revision, language: language2, state, error });
      };
      const listener = (event) => {
        if (destroyed || window.parent === window || event.source !== window.parent || event.origin !== parentOrigin || !isSyncMessage(event.data)) return;
        const message = event.data;
        if (message.type === "probe") {
          if (currentConnection !== message.connection) {
            currentConnection = message.connection;
            latestRevision = -1;
          }
          announce();
          return;
        }
        if (message.type !== "set" || message.session !== session || currentConnection && currentConnection !== message.connection || message.revision <= latestRevision) return;
        currentConnection = message.connection;
        latestRevision = message.revision;
        latestLanguage = message.language;
        const { connection, revision, language: language2 } = message;
        void translator.switchLanguage(language2).then((result) => {
          if (result.status !== "superseded") reply(result.status, connection, revision, language2);
        }, (error) => reply("error", connection, revision, language2, errorText(error)));
      };
      window.addEventListener("message", listener);
      const unsubscribe = translator.onStatusChange((event) => {
        if (event.state === "error" && latestRevision >= 0) reply("error", currentConnection, latestRevision, latestLanguage, event.error);
      });
      const bridge = { destroy() {
        if (destroyed) return;
        destroyed = true;
        unsubscribe();
        window.removeEventListener("message", listener);
        if (activeChild === bridge) activeChild = void 0;
      } };
      activeChild = bridge;
      announce();
      return bridge;
    }
    function readSyncOptions(script) {
      const parent = script == null ? void 0 : script.dataset.syncParentOrigin;
      const children = script == null ? void 0 : script.dataset.syncIframeOrigins;
      return {
        ...parent !== void 0 ? { parentOrigin: exactOrigin(parent.trim()) } : {},
        iframeOrigins: children === void 0 ? [] : [...new Set(children.split(",").map((origin) => exactOrigin(origin.trim())))]
      };
    }
    let activeAutoSync;
    function installAutoSync(translator, options) {
      options.iframeOrigins.forEach(exactOrigin);
      if (options.parentOrigin) exactOrigin(options.parentOrigin);
      activeAutoSync == null ? void 0 : activeAutoSync.destroy();
      const allowed = new Set(options.iframeOrigins);
      let destroyed = false;
      const child = options.parentOrigin && window.parent !== window ? connectIframe({ translator, parentOrigin: options.parentOrigin }) : void 0;
      const parent = allowed.size ? connectParent({
        translator,
        frames: [],
        onStatus: (status) => window.dispatchEvent(new CustomEvent("translator:iframe-status", { detail: status }))
      }) : void 0;
      const registered = /* @__PURE__ */ new Map();
      const source = (iframe) => `${iframe.getAttribute("src") ?? ""}
  ${iframe.getAttribute("srcdoc") ?? ""}`;
      const register = (iframe, origin) => {
        const remove = parent.addFrame({ iframe, origin, allowedOrigins: [...allowed] });
        registered.set(iframe, { source: source(iframe), remove });
      };
      const scan = () => {
        if (destroyed || !parent) return;
        const frames = new Set(document.querySelectorAll("iframe"));
        for (const [iframe, entry] of registered) {
          if (!frames.has(iframe) || entry.source !== source(iframe)) {
            entry.remove();
            registered.delete(iframe);
          }
        }
        for (const iframe of frames) {
          if (registered.has(iframe) || iframe.hasAttribute("srcdoc")) continue;
          try {
            const origin = new URL(iframe.getAttribute("src") ?? "about:blank", document.baseURI).origin;
            if (allowed.has(origin)) register(iframe, origin);
          } catch {
          }
        }
      };
      const announcement = (event) => {
        if (destroyed || !parent || !allowed.has(event.origin) || !isSyncMessage(event.data) || !["ready", "failed"].includes(event.data.type)) return;
        const iframe = [...document.querySelectorAll("iframe")].find((frame) => frame.contentWindow === event.source);
        if (iframe && !registered.has(iframe)) register(iframe, event.origin);
      };
      const observer = parent ? new MutationObserver(scan) : void 0;
      if (parent) {
        window.addEventListener("message", announcement);
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "srcdoc"] });
        scan();
      }
      const connection = { destroy() {
        if (destroyed) return;
        destroyed = true;
        observer == null ? void 0 : observer.disconnect();
        window.removeEventListener("message", announcement);
        child == null ? void 0 : child.destroy();
        parent == null ? void 0 : parent.destroy();
        registered.clear();
        if (activeAutoSync === connection) activeAutoSync = void 0;
      } };
      activeAutoSync = connection;
      return connection;
    }
    const BUILD_INFO = {
      version: "1.0.1",
      buildTime: (/* @__PURE__ */ new Date()).toISOString(),
      environment: "development"
    };
    if (typeof window !== "undefined") {
      window.__TRANSLATOR_BUILD_INFO = BUILD_INFO;
    }
    class TextTranslationEngine {
      constructor(apiService, configManager) {
        this.observer = null;
        this.currentAbortController = null;
        this.languageDropdown = null;
        this.translatedLabels = void 0;
        this.isTranslating = false;
        this.serviceUnavailable = false;
        this.originalTitle = null;
        this.originalDescription = null;
        this.generation = 0;
        this.sourceNodes = /* @__PURE__ */ new Map();
        this.batchControllers = /* @__PURE__ */ new Set();
        this.translationFailed = false;
        this.publicAPI = null;
        this.onTranslatedPageReady = null;
        this.apiService = apiService;
        this.configManager = configManager;
        this.sender = new DebouncedSender(
          (payload) => this.translateBatch(payload),
          TIMINGS.DYNAMIC_TRANSLATION_DEBOUNCE
        );
        this.navigationService = new NavigationService();
        this.navigationService.setHandler(() => this.handleUrlChange());
      }
      setTranslating(isTranslating) {
        this.isTranslating = isTranslating;
        this.updateLanguageDropdown(this.translatedLabels);
      }
      /** Stamped SEO routes (subdomain or subdirectory) use warm edge cache — skip loader chrome. */
      shouldSkipTranslationLoaders() {
        return this.configManager.getSeoContext().mode !== "source";
      }
      updateLanguageDropdown(translatedDropdownLabels) {
        if (!SCRIPT_CONFIG.showSelector) return;
        const config = this.configManager.getTranslationConfig();
        if (!config) {
          console.error("❌ Cannot update dropdown: No configuration available");
          return;
        }
        const dropdownOptions = {
          config,
          currentLang: this.configManager.getCurrentLanguage(),
          theme: SCRIPT_CONFIG.theme,
          translatedDropdownLabels,
          isTranslating: this.isTranslating,
          disabled: this.serviceUnavailable
        };
        if (!this.languageDropdown) {
          this.languageDropdown = new LanguageDropdown({
            ...dropdownOptions,
            onLanguageChange: (newLang) => {
              var _a;
              void (((_a = this.publicAPI) == null ? void 0 : _a.switchLanguage(newLang)) ?? this.switchLanguage(newLang)).catch((error) => console.error("Language change failed:", error));
            }
          });
          this.languageDropdown.create();
        } else {
          this.languageDropdown.update(dropdownOptions);
        }
      }
      async syncDropdownLabels(targetLang) {
        const config = this.configManager.getTranslationConfig();
        const apiConfig = this.configManager.getApiConfig();
        if (!config || !apiConfig || targetLang === config.defaultLang) {
          return;
        }
        if (this.translatedLabels && Object.keys(this.translatedLabels).length > 0) {
          return;
        }
        const { keys, labels } = buildDropdownLabelPayload(config);
        if (labels.length === 0) {
          return;
        }
        try {
          const translated2 = await this.apiService.fetchTranslatedDropdownLabels({
            translateConfig: {
              targetLanguage: targetLang,
              sourceLanguage: config.defaultLang,
              websiteId: config.websiteId
            },
            apiConfig,
            dropdownLabels: labels,
            pageContext: PageContextCollector.collectPageContext()
          });
          this.translatedLabels = mapTranslatedDropdownLabels(keys, translated2);
          this.updateLanguageDropdown(this.translatedLabels);
        } catch (error) {
          console.warn("Failed to sync dropdown labels:", error);
        }
      }
      abortCurrentTranslation() {
        if (this.currentAbortController) {
          this.currentAbortController.abort();
          this.currentAbortController = null;
        }
      }
      async restoreToSourceLanguage() {
        var _a;
        (_a = this.observer) == null ? void 0 : _a.stop();
        const attributeElements = document.querySelectorAll(`[${ATTRIBUTES.TRANSLATED_TO}]`);
        for (const [node, source] of this.sourceNodes) {
          if (node.isConnected) node.textContent = source;
          clearTranslatedText(node);
          translated.delete(node);
          queued.delete(node);
        }
        document.querySelectorAll(`[${ATTRIBUTES.SOURCE_TEXT}]`).forEach((element) => {
          const sourceText = element.getAttribute(ATTRIBUTES.SOURCE_TEXT);
          const childNodes = Array.from(element.childNodes);
          const textNode = childNodes.find((node) => node.nodeType === Node.TEXT_NODE);
          if (sourceText && textNode && !this.sourceNodes.has(textNode)) {
            textNode.textContent = sourceText;
            clearTranslatedText(textNode);
          }
          element.removeAttribute(ATTRIBUTES.TRANSLATED_TO);
          element.removeAttribute(ATTRIBUTES.TRANSLATION_STATE);
          element.removeAttribute(ATTRIBUTES.SOURCE_TEXT);
        });
        attributeElements.forEach((element) => {
          const attributesToRemove = [];
          for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            if (attr.name.startsWith(ATTRIBUTES.SOURCE_ATTRIBUTE_PREFIX)) {
              const originalAttrName = attr.name.substring(ATTRIBUTES.SOURCE_ATTRIBUTE_PREFIX.length);
              element.setAttribute(originalAttrName, attr.value);
              attributesToRemove.push(attr.name);
            }
          }
          attributesToRemove.forEach((attrName) => element.removeAttribute(attrName));
          element.removeAttribute(ATTRIBUTES.TRANSLATED_TO);
          element.removeAttribute(ATTRIBUTES.TRANSLATION_STATE);
          clearTranslatedAttribute(element);
          translated.delete(element);
          queued.delete(element);
        });
        document.querySelectorAll(`[${ATTRIBUTES.TRANSLATION_STATE}]`).forEach((element) => {
          element.removeAttribute(ATTRIBUTES.TRANSLATION_STATE);
        });
        if (this.originalTitle) {
          document.title = this.originalTitle;
        }
        const meta = document.querySelector('meta[name="description"]');
        if (meta && this.originalDescription) {
          meta.content = this.originalDescription;
        }
        this.translatedLabels = void 0;
        this.sourceNodes.clear();
      }
      applyTranslatedTextNodes(translatedTexts, nodeMap, targetLang) {
        translatedTexts.forEach((translatedText, index) => {
          var _a, _b;
          const target = nodeMap.get(index);
          if (!target) return;
          const liveNode = this.resolveLiveTextTarget(target);
          if (!liveNode || !liveNode.parentElement) return;
          const parentElement = liveNode.parentElement;
          const originalText = target.sourceText;
          this.sourceNodes.set(liveNode, originalText);
          if (!parentElement.hasAttribute(ATTRIBUTES.SOURCE_TEXT)) {
            parentElement.setAttribute(ATTRIBUTES.SOURCE_TEXT, originalText);
          }
          parentElement.setAttribute(ATTRIBUTES.TRANSLATION_STATE, "translated");
          parentElement.setAttribute(ATTRIBUTES.TRANSLATED_TO, targetLang);
          const trimmedTranslated = translatedText.trim();
          setTranslatedText(liveNode, trimmedTranslated);
          if (this.normalizeText(originalText) !== this.normalizeText(trimmedTranslated)) {
            const leadingWs = ((_a = originalText.match(/^\s+/)) == null ? void 0 : _a[0]) || "";
            const trailingWs = ((_b = originalText.match(/\s+$/)) == null ? void 0 : _b[0]) || "";
            liveNode.textContent = `${leadingWs}${trimmedTranslated}${trailingWs}`;
          }
        });
        const config = this.configManager.getTranslationConfig();
        if (config && this.configManager.getSeoContext().mode === "source") {
          DomUtils.updateCanonicalUrl(targetLang, config.defaultLang);
        }
      }
      resolveLiveTextTarget(target) {
        var _a;
        if ((_a = target.node.parentElement) == null ? void 0 : _a.isConnected) {
          return target.node;
        }
        if (!target.parent.isConnected) {
          return null;
        }
        const liveTextNode = this.findFirstMeaningfulTextNode(target.parent);
        if (!liveTextNode) {
          return null;
        }
        const liveText = liveTextNode.textContent || "";
        if (this.normalizeText(liveText) !== this.normalizeText(target.sourceText)) {
          target.parent.setAttribute(ATTRIBUTES.SOURCE_TEXT, liveText);
          target.parent.removeAttribute(ATTRIBUTES.TRANSLATION_STATE);
          target.parent.removeAttribute(ATTRIBUTES.TRANSLATED_TO);
          if (!this.configManager.isInDefaultLanguage()) {
            this.enqueue(target.parent);
          }
          return null;
        }
        return liveTextNode;
      }
      findFirstMeaningfulTextNode(parent) {
        const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            var _a;
            const text = (_a = node.textContent) == null ? void 0 : _a.trim();
            return text ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
        });
        return walker.nextNode();
      }
      normalizeText(text) {
        return text.replace(/\s+/g, " ").trim();
      }
      async translatePage(targetLang) {
        this.abortCurrentTranslation();
        const config = this.configManager.getTranslationConfig();
        if (!config) {
          throw new Error("No config available for translation");
        }
        if (targetLang === config.defaultLang) {
          return this.restoreToSourceLanguage();
        }
        const { textNodes, nodeMap, attributeTexts, attributeMap } = TextExtractor.extractFreshContentForLanguage(
          document,
          targetLang,
          (text) => TextExtractor.isJsonString(text) || TextExtractor.isUnwantedContent(text)
        );
        const { keys: dropdownLabelKeys, labels: dropdownLabels } = buildDropdownLabelPayload(config);
        if (!this.originalTitle) {
          this.originalTitle = document.title;
        }
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && !this.originalDescription) {
          this.originalDescription = metaDesc.content;
        }
        const metadata = MetadataUtils.collectMetadata();
        const metadataTexts = metadata.map(([, value]) => value);
        if (textNodes.length === 0 && metadataTexts.length === 0 && attributeTexts.length === 0) {
          this.notifyTranslatedPageReady();
          return;
        }
        const skipLoaders = this.shouldSkipTranslationLoaders();
        if (!skipLoaders) {
          this.setTranslating(true);
        }
        const skeletonMap = /* @__PURE__ */ new Map();
        nodeMap.forEach((target, _key) => {
          if (!target.parent.hasAttribute(ATTRIBUTES.SOURCE_TEXT)) {
            target.parent.setAttribute(ATTRIBUTES.SOURCE_TEXT, target.sourceText);
          }
        });
        if (!skipLoaders) {
          nodeMap.forEach((target, key) => {
            const skeleton = SkeletonManager.apply(target.node);
            if (skeleton) {
              skeletonMap.set(key, skeleton);
            }
          });
        }
        try {
          const translationConfig = this.configManager.getTranslationConfig();
          const apiConfig = this.configManager.getApiConfig();
          if (!translationConfig || !apiConfig) {
            throw new Error("No config available for translation");
          }
          const translateConfig = {
            targetLanguage: targetLang,
            sourceLanguage: translationConfig.defaultLang,
            websiteId: translationConfig.websiteId
          };
          this.currentAbortController = new AbortController();
          const pageContext = PageContextCollector.collectPageContext();
          const fullTextNodes = [...textNodes, ...attributeTexts, ...metadataTexts];
          const response = await this.apiService.translateTextBased({
            textNodes: fullTextNodes,
            translateConfig,
            apiConfig,
            dropdownLabels,
            pageContext,
            abortSignal: this.currentAbortController.signal
          });
          skeletonMap.forEach((skeleton) => {
            SkeletonManager.remove(skeleton);
          });
          const translatedFullNodes = response.translatedTextNodes || [];
          const translatedDropdownLabels = response.translatedDropdownLabels || [];
          const translatedTextNodes = translatedFullNodes.slice(0, textNodes.length);
          const translatedAttributeTexts = translatedFullNodes.slice(
            textNodes.length,
            textNodes.length + attributeTexts.length
          );
          const translatedMetadataTexts = translatedFullNodes.slice(textNodes.length + attributeTexts.length);
          this.applyTranslatedTextNodes(translatedTextNodes, nodeMap, targetLang);
          this.applyTranslatedAttributes(translatedAttributeTexts, attributeMap, targetLang);
          const translatedMetadata = metadata.map(([key], i) => [
            key,
            translatedMetadataTexts[i] || ""
          ]);
          MetadataUtils.applyMetadata(translatedMetadata, targetLang);
          applyDirection(targetLang);
          this.translatedLabels = mapTranslatedDropdownLabels(dropdownLabelKeys, translatedDropdownLabels);
          this.updateLanguageDropdown(this.translatedLabels);
          if (!skipLoaders) {
            this.setTranslating(false);
          }
          this.notifyTranslatedPageReady();
        } catch (error) {
          skeletonMap.forEach((skeleton) => {
            SkeletonManager.remove(skeleton);
          });
          if (ApiService.isAbortError(error)) {
            if (!skipLoaders) {
              this.setTranslating(false);
            }
            throw error;
          }
          console.error("❌ Text translation failed:", error);
          if (!skipLoaders) {
            this.setTranslating(false);
          }
          throw error;
        } finally {
          this.currentAbortController = null;
        }
      }
      applyTranslatedAttributes(translatedAttributes, attributeMap, targetLang) {
        translatedAttributes.forEach((translatedText, index) => {
          const attributeInfo = attributeMap.get(index);
          if (!attributeInfo) return;
          const { element, attribute } = attributeInfo;
          const sourceAttributeName = `${ATTRIBUTES.SOURCE_ATTRIBUTE_PREFIX}${attribute}`;
          const originalText = element.getAttribute(attribute) || "";
          if (!element.hasAttribute(sourceAttributeName)) {
            element.setAttribute(sourceAttributeName, originalText);
          }
          element.setAttribute(ATTRIBUTES.TRANSLATION_STATE, "translated");
          element.setAttribute(ATTRIBUTES.TRANSLATED_TO, targetLang);
          const trimmedTranslated = translatedText.trim();
          setTranslatedAttribute(element, attribute, trimmedTranslated);
          if (originalText.trim() !== trimmedTranslated) {
            element.setAttribute(attribute, trimmedTranslated);
          }
        });
      }
      async translateBatch(payload) {
        var _a;
        const generation = this.generation;
        const { texts, textMap, attributeTexts, attributeMap } = payload;
        if (texts.length === 0 && attributeTexts.length === 0) return;
        textMap.forEach((target, index) => {
          if (!target.parent.hasAttribute(ATTRIBUTES.SOURCE_TEXT)) {
            target.parent.setAttribute(ATTRIBUTES.SOURCE_TEXT, texts[index]);
          }
        });
        attributeMap.forEach(({ element, attribute }, index) => {
          const sourceAttributeName = `${ATTRIBUTES.SOURCE_ATTRIBUTE_PREFIX}${attribute}`;
          if (!element.hasAttribute(sourceAttributeName)) {
            element.setAttribute(sourceAttributeName, attributeTexts[index]);
          }
        });
        textMap.forEach((target) => {
          target.parent.setAttribute(ATTRIBUTES.TRANSLATION_STATE, "translating");
        });
        attributeMap.forEach(({ element }) => {
          element.setAttribute(ATTRIBUTES.TRANSLATION_STATE, "translating");
        });
        const apiConfig = this.configManager.getApiConfig();
        const translationConfig = this.configManager.getTranslationConfig();
        if (!apiConfig || !translationConfig) return;
        if (this.configManager.isInDefaultLanguage()) {
          textMap.forEach((target) => {
            queued.delete(target.node);
            translated.add(target.node);
          });
          attributeMap.forEach(({ element }) => {
            queued.delete(element);
            translated.add(element);
          });
          return;
        }
        const skipLoaders = this.shouldSkipTranslationLoaders();
        const skeletonMap = /* @__PURE__ */ new Map();
        if (!skipLoaders) {
          textMap.forEach((target, key) => {
            const skeleton = SkeletonManager.apply(target.node);
            if (skeleton) {
              skeletonMap.set(key, skeleton);
            }
          });
        }
        const translateCfg = {
          targetLanguage: this.configManager.getCurrentLanguage(),
          sourceLanguage: translationConfig.defaultLang,
          websiteId: translationConfig.websiteId
        };
        const controller = new AbortController();
        this.batchControllers.add(controller);
        try {
          const allTexts = [...texts, ...attributeTexts];
          const resp = await this.apiService.translateTextBased({
            textNodes: allTexts,
            translateConfig: translateCfg,
            apiConfig,
            dropdownLabels: [],
            pageContext: PageContextCollector.collectPageContext(),
            abortSignal: controller.signal
          });
          if (generation !== this.generation) return;
          const allTranslated = resp.translatedTextNodes || [];
          const translatedTexts = allTranslated.slice(0, texts.length);
          const translatedAttributes = allTranslated.slice(texts.length);
          skeletonMap.forEach((skeleton) => {
            SkeletonManager.remove(skeleton);
          });
          this.applyTranslatedTextNodes(translatedTexts, textMap, translateCfg.targetLanguage);
          this.applyTranslatedAttributes(translatedAttributes, attributeMap, translateCfg.targetLanguage);
          textMap.forEach((target) => {
            queued.delete(target.node);
            translated.add(target.node);
          });
          attributeMap.forEach(({ element }) => {
            queued.delete(element);
            translated.add(element);
          });
        } catch (error) {
          if (generation !== this.generation || ApiService.isAbortError(error)) return;
          this.translationFailed = true;
          (_a = this.publicAPI) == null ? void 0 : _a.report("error", error);
          console.error("❌ translateBatch failed:", error);
          textMap.forEach((target) => {
            target.parent.removeAttribute(ATTRIBUTES.TRANSLATION_STATE);
          });
          attributeMap.forEach(({ element }) => {
            element.removeAttribute(ATTRIBUTES.TRANSLATION_STATE);
          });
          skeletonMap.forEach((skeleton) => SkeletonManager.remove(skeleton));
          throw error;
        } finally {
          this.batchControllers.delete(controller);
          skeletonMap.forEach((skeleton) => SkeletonManager.remove(skeleton));
        }
      }
      async switchLanguage(newLang) {
        if (newLang === this.configManager.getCurrentLanguage() && !this.translationFailed) return "complete";
        const config = this.configManager.getTranslationConfig();
        if (!config) {
          throw new Error("No configuration available");
        }
        if (![config.defaultLang, ...config.targetLanguages].includes(newLang)) throw new Error("Unsupported language");
        this.generation++;
        this.sender.clear();
        for (const controller of this.batchControllers) controller.abort();
        if (shouldNavigateForSeoLanguageChange(config.seoConfiguration)) {
          const targetUrl = buildLanguageUrl({
            seoConfiguration: config.seoConfiguration,
            defaultLang: config.defaultLang,
            targetLocale: newLang,
            currentUrl: new URL(window.location.href)
          });
          if (!targetUrl) {
            ErrorHandler.showErrorMessage(
              "unsupported-language",
              "This language is not available on this site yet."
            );
            throw new Error("Unsupported SEO language");
          }
          const resolvedTarget = new URL(targetUrl);
          const current = new URL(window.location.href);
          this.configManager.setCurrentLanguage(newLang);
          if (resolvedTarget.href !== current.href) {
            window.location.assign(targetUrl);
            return "reloading";
          }
          return "complete";
        }
        if (newLang === config.defaultLang) {
          this.configManager.setCurrentLanguage(newLang);
          if (SCRIPT_CONFIG.sourceLanguageBehavior === "reload") {
            window.location.reload();
            return "reloading";
          }
          this.abortCurrentTranslation();
          await this.restoreToSourceLanguage();
          document.documentElement.lang = newLang;
          applyDirection(newLang);
          this.updateLanguageDropdown();
          this.startObserver();
          this.translationFailed = false;
          return "complete";
        }
        await this.switchLanguageClientSide(newLang);
        this.translationFailed = false;
        return "complete";
      }
      async switchLanguageClientSide(newLang, options) {
        var _a;
        const config = this.configManager.getTranslationConfig();
        if (!config) {
          return;
        }
        const showLoader = !this.shouldSkipTranslationLoaders();
        try {
          this.abortCurrentTranslation();
          (_a = this.observer) == null ? void 0 : _a.stop();
          this.configManager.setCurrentLanguage(newLang, options);
          if (showLoader) {
            this.setTranslating(true);
          }
          await this.restoreToSourceLanguage();
          await this.translatePage(newLang);
          applyDirection(newLang);
          this.updateLanguageDropdown(this.translatedLabels);
          this.startObserver();
        } catch (e) {
          this.translationFailed = true;
          console.error("❌ Switch language failed:", e);
          if (e instanceof Error) {
            if (e.message === "NETWORK_ERROR") {
              ErrorHandler.showErrorMessage(
                "network",
                "Failed to switch language. Please check your connection."
              );
            } else if (e.message === "RATE_LIMIT") {
              ErrorHandler.showErrorMessage("rate-limit", "Too many requests. Please try again later.");
            } else {
              ErrorHandler.showErrorMessage("server", "Failed to switch language. Please try again.");
            }
          }
          await this.restoreToSourceLanguage();
          this.configManager.setCurrentLanguage(config.defaultLang, { persist: false });
          document.documentElement.lang = config.defaultLang;
          this.updateLanguageDropdown();
          this.startObserver();
          throw e;
        } finally {
          if (showLoader) {
            this.setTranslating(false);
          }
        }
      }
      clearMetadataSourceAttributes() {
        this.originalTitle = null;
        this.originalDescription = null;
      }
      clearTranslationAttributes() {
        document.querySelectorAll(`[${ATTRIBUTES.TRANSLATED_TO}]`).forEach((element) => {
          element.removeAttribute(ATTRIBUTES.TRANSLATED_TO);
        });
        document.querySelectorAll(`[${ATTRIBUTES.TRANSLATION_STATE}]`).forEach((element) => {
          element.removeAttribute(ATTRIBUTES.TRANSLATION_STATE);
        });
      }
      async waitForInitialContent() {
        await waitForDomToSettle(document.body);
      }
      async initialize() {
        var _a;
        if (!SCRIPT_CONFIG.apiKey) {
          console.error("❌ No API key provided");
          ErrorHandler.showErrorMessage("auth", "Translation service not configured. Missing API key.");
          throw new Error("Missing API key");
        }
        if (!SCRIPT_CONFIG.domain) {
          console.error("❌ No domain provided");
          ErrorHandler.showErrorMessage("config-invalid", "Translation service not configured. Missing domain.");
          throw new Error("Missing domain");
        }
        DomUtils.detectCSPViolations();
        await this.waitForDOMReady();
        await this.waitForInitialContent();
        const config = await this.configManager.initializeConfig();
        if (!config) {
          throw new Error("Initialization failed: No config available");
        }
        const style = document.createElement("style");
        style.textContent = `
              .tl-skeleton {
                  color: transparent !important;
                  background-color: var(--skeleton-bg-color, #e0e0e0) !important;
                  background-image: linear-gradient(
                      90deg,
                      var(--skeleton-bg-color, #e0e0e0),
                      var(--skeleton-highlight-color, #f0f0f0),
                      var(--skeleton-bg-color, #e0e0e0)
                  ) !important;
                  background-size: 200% 100% !important;
                  animation: skeleton-pulse 1.5s linear infinite !important;
                  border-radius: 4px !important;
                  user-select: none !important;
                  margin-left: 1px !important;
                  margin-right: 1px !important;
                  -webkit-user-select: none !important;
              }
  
              @keyframes skeleton-pulse {
                  0% {
                      background-position: 100% 0;
                  }
                  100% {
                      background-position: -100% 0;
                  }
              }
          `;
        document.head.appendChild(style);
        this.updateLanguageDropdown();
        this.hydrateTranslatedStoreFromDom();
        this.startObserver();
        const seoActive = usesSeoRouting(config.seoConfiguration);
        const currentLang = this.configManager.getCurrentLanguage();
        const apiConfig = this.configManager.getApiConfig();
        const usesWorkerTranslate = Boolean(apiConfig == null ? void 0 : apiConfig.translateApiUrl);
        const needsTranslation = !this.configManager.isInDefaultLanguage() && this.pageHasUntranslatedContent(currentLang);
        if (needsTranslation && !usesWorkerTranslate) {
          try {
            if (apiConfig) {
              const ok = await this.apiService.checkRedisAvailability({
                translateConfig: {
                  targetLanguage: currentLang,
                  sourceLanguage: config.defaultLang,
                  websiteId: config.websiteId
                },
                apiConfig: { key: apiConfig.key, domain: apiConfig.domain },
                pageContext: PageContextCollector.collectPageContext()
              });
              if (!ok) {
                ErrorHandler.showErrorMessage(
                  "cache-unavailable",
                  "Cache service not configured/available. Translation disabled until restored."
                );
                (_a = this.languageDropdown) == null ? void 0 : _a.update({ disabled: true });
                this.serviceUnavailable = true;
                throw new Error("Translation service unavailable");
              }
            }
          } catch (e) {
            throw e;
          }
        }
        if (needsTranslation) {
          if (currentLang === (config == null ? void 0 : config.defaultLang)) {
            await this.restoreToSourceLanguage();
          } else {
            await this.translatePage(currentLang);
          }
        }
        if (seoActive && currentLang !== config.defaultLang) {
          await this.syncDropdownLabels(currentLang);
        }
        applyDirection(this.configManager.getCurrentLanguage());
        this.navigationService.start();
        window.addEventListener("offline", () => {
          ErrorHandler.showErrorMessage("offline", "You are now offline. Using cached translations where available.");
        });
        window.addEventListener("online", () => {
          ErrorHandler.clearError();
        });
        window.addEventListener("beforeunload", () => {
          this.abortCurrentTranslation();
          this.navigationService.stop();
        });
        this.notifyTranslatedPageReady();
      }
      notifyTranslatedPageReady() {
        var _a;
        if (this.configManager.isInDefaultLanguage()) return;
        void ((_a = this.onTranslatedPageReady) == null ? void 0 : _a.call(this));
      }
      async waitForDOMReady() {
        if (document.readyState === "loading") {
          await new Promise((resolve) => {
            document.addEventListener("DOMContentLoaded", resolve);
          });
        }
      }
      async handleUrlChange() {
        this.abortCurrentTranslation();
        this.configManager.refreshSeoContextFromLocation();
        const config = this.configManager.getTranslationConfig();
        if (!config) {
          return;
        }
        const currentLang = this.configManager.getCurrentLanguage();
        if (usesSeoRouting(config.seoConfiguration)) {
          if (currentLang !== config.defaultLang) {
            await this.syncDropdownLabels(currentLang);
          } else {
            this.translatedLabels = void 0;
            this.updateLanguageDropdown();
          }
          await waitForDomToSettle(document.body);
          if (currentLang !== config.defaultLang && this.pageHasUntranslatedContent(currentLang)) {
            try {
              await this.translatePage(currentLang);
            } catch (err) {
              console.error("❌ Translation failed during URL change:", err);
            }
          } else if (currentLang !== config.defaultLang) {
            applyDirection(currentLang);
          }
          return;
        }
        this.clearTranslationAttributes();
        this.clearMetadataSourceAttributes();
        await waitForDomToSettle(document.body);
        if (!this.configManager.isInDefaultLanguage()) {
          try {
            await this.translatePage(currentLang);
          } catch (err) {
            console.error("❌ Translation failed during URL change:", err);
          }
        }
      }
      pageHasUntranslatedContent(targetLang) {
        const { textNodes, attributeTexts } = TextExtractor.extractFreshContentForLanguage(
          document,
          targetLang,
          (text) => TextExtractor.isJsonString(text) || TextExtractor.isUnwantedContent(text)
        );
        const metadata = MetadataUtils.collectMetadata();
        return textNodes.length > 0 || attributeTexts.length > 0 || metadata.length > 0;
      }
      hydrateTranslatedStoreFromDom() {
        document.querySelectorAll(`[${ATTRIBUTES.SOURCE_TEXT}]`).forEach((element) => {
          const textNode = Array.from(element.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
          if (!textNode) {
            return;
          }
          const stampedSource = element.getAttribute(ATTRIBUTES.SOURCE_TEXT) || textNode.textContent || "";
          setTranslatedText(textNode, textNode.textContent || stampedSource);
        });
      }
      enqueue(element) {
        this.sender.enqueue(element);
      }
      startObserver() {
        var _a;
        (_a = this.observer) == null ? void 0 : _a.stop();
        const config = this.configManager.getTranslationConfig();
        if (!config) return;
        this.observer ?? (this.observer = new TranslationObserver(
          () => {
          },
          (element) => this.enqueue(element),
          this.configManager
        ));
        this.observer.start();
      }
    }
    const SCRIPT_CONFIG = (() => {
      const tag = document.currentScript;
      const rawDomain = (tag == null ? void 0 : tag.dataset.domain) || window.location.host;
      const domain = DomUtils.normalizeDomain(rawDomain);
      const apiKey = (tag == null ? void 0 : tag.dataset.apiKey) || "";
      const theme = (tag == null ? void 0 : tag.dataset.theme) || "dark";
      const disableAutoBrowserTranslation = (tag == null ? void 0 : tag.dataset.disableAutoBrowserTranslation) === "true";
      let syncOptions;
      try {
        syncOptions = readSyncOptions(tag);
      } catch (error) {
        console.error("Automatic translator synchronization disabled: invalid origins", error);
      }
      const embeddedFollower = Boolean((syncOptions == null ? void 0 : syncOptions.parentOrigin) && window.parent !== window);
      const syncEnabled = Boolean((syncOptions == null ? void 0 : syncOptions.parentOrigin) || (syncOptions == null ? void 0 : syncOptions.iframeOrigins.length));
      const showSelector = (tag == null ? void 0 : tag.dataset.showSelector) === void 0 ? !embeddedFollower : tag.dataset.showSelector !== "false";
      const sourceLanguageBehavior = (tag == null ? void 0 : tag.dataset.sourceLanguageBehavior) === void 0 && syncEnabled ? "restore" : (tag == null ? void 0 : tag.dataset.sourceLanguageBehavior) === "restore" ? "restore" : "reload";
      const apiRoot = tag == null ? void 0 : tag.dataset.apiRoot;
      return { apiKey, domain, theme, disableAutoBrowserTranslation, showSelector, sourceLanguageBehavior, apiRoot, syncOptions, followParentLanguage: embeddedFollower };
    })();
    (async () => {
      if (window.__translateDone) {
        throw "already injected";
      }
      window.__translateDone = true;
      const apiService = new ApiService({ configApiUrl: SCRIPT_CONFIG.apiRoot });
      const configManager = new ConfigManager(apiService, SCRIPT_CONFIG);
      const translationEngine = new TextTranslationEngine(apiService, configManager);
      let cacheEditor = null;
      let cacheEditorStartupPromise = null;
      async function ensureCacheEditorRunning() {
        if (SCRIPT_CONFIG.followParentLanguage) return;
        if (cacheEditor) return;
        if (configManager.isInDefaultLanguage()) return;
        if (!cacheEditorStartupPromise) {
          cacheEditorStartupPromise = (async () => {
            try {
              if (!await apiService.shouldEnableEditSession({ key: SCRIPT_CONFIG.apiKey })) {
                return;
              }
              if (cacheEditor) return;
              cacheEditor = new CacheEditorService(apiService, configManager, SCRIPT_CONFIG.theme);
              cacheEditor.start();
              window.addEventListener("beforeunload", () => cacheEditor == null ? void 0 : cacheEditor.stop());
            } finally {
              cacheEditorStartupPromise = null;
            }
          })();
        }
        await cacheEditorStartupPromise;
      }
      translationEngine.onTranslatedPageReady = () => {
        void ensureCacheEditorRunning();
      };
      const initialization = translationEngine.initialize();
      const publicAPI = new TranslatorAPI(initialization, () => {
        const config = configManager.getTranslationConfig();
        return { currentLang: configManager.getCurrentLanguage(), languages: [config.defaultLang, ...config.targetLanguages] };
      }, (language2) => translationEngine.switchLanguage(language2));
      translationEngine.publicAPI = publicAPI;
      window.translator = publicAPI;
      window.translatorSync = { connectParent, connectIframe };
      let automaticSync;
      const startSync = () => {
        if (SCRIPT_CONFIG.syncOptions && (SCRIPT_CONFIG.syncOptions.parentOrigin || SCRIPT_CONFIG.syncOptions.iframeOrigins.length)) {
          automaticSync = installAutoSync(publicAPI, SCRIPT_CONFIG.syncOptions);
        }
      };
      startSync();
      window.addEventListener("pagehide", () => {
        automaticSync == null ? void 0 : automaticSync.destroy();
        automaticSync = void 0;
      });
      window.addEventListener("pageshow", (event) => {
        if (event.persisted) startSync();
      });
      window.dispatchEvent(new Event("translator:available"));
      await publicAPI.ready.catch((error) => console.error("Translator initialization failed:", error));
    })();
    exports.TranslatorAPI = TranslatorAPI;
    exports.connectIframe = connectIframe;
    exports.connectParent = connectParent;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    return exports;
  }({});
  //# sourceMappingURL=translator.dev.js.map
  