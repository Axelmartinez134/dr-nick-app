"use strict";
(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [91738],
  {
    26908: (e, t, n) => {
      n.d(t, { FR: () => u, FV: () => d, Fc: () => g, QK: () => m, UL: () => o, iL: () => c, vC: () => s });
      var a = n(90944),
        r = n(59245),
        l = n(41299),
        i = n(78753);
      function s(e, t) {
        var n;
        return (0, a.I)({
          queryKey: ["workspace-logos", null != e ? e : "all"],
          queryFn: async () => {
            let t = e ? "?type=".concat(e) : "";
            return (await i.FH.get("/api/v1/workspaces/logos".concat(t))).logos;
          },
          enabled: null == (n = null == t ? void 0 : t.enabled) || n,
          staleTime: 3e5,
        });
      }
      function o(e) {
        return s("asset", e);
      }
      function c() {
        let e = (0, r.jE)();
        return (0, l.n)({
          mutationFn: async (e) => await i.FH.post("/api/v1/workspaces/logos", e),
          onSuccess: () => {
            e.invalidateQueries({ queryKey: ["workspace-logos"] });
          },
        });
      }
      function d() {
        let e = (0, r.jE)();
        return (0, l.n)({
          mutationFn: async (e) => await i.FH.post("/api/v1/workspaces/logos", { ...e, type: "asset" }),
          onSuccess: () => {
            e.invalidateQueries({ queryKey: ["workspace-logos"] });
          },
        });
      }
      function u() {
        let e = (0, r.jE)();
        return (0, l.n)({
          mutationFn: async (e) => await i.FH.delete("/api/v1/workspaces/logos/".concat(e)),
          onSuccess: () => {
            e.invalidateQueries({ queryKey: ["workspace-logos"] });
          },
        });
      }
      function g() {
        let e = (0, r.jE)();
        return (0, l.n)({
          mutationFn: async (e) => {
            let { logoId: t, data: n } = e;
            return await i.FH.put("/api/v1/workspaces/logos/".concat(t), n);
          },
          onSuccess: () => {
            e.invalidateQueries({ queryKey: ["workspace-logos"] });
          },
        });
      }
      function m() {
        let e = (0, r.jE)();
        return (0, l.n)({
          mutationFn: async (e) => await i.FH.put("/api/v1/workspaces/logos/".concat(e), { isDefault: !0 }),
          onSuccess: () => {
            e.invalidateQueries({ queryKey: ["workspace-logos"] });
          },
        });
      }
    },
    91738: (e, t, n) => {
      (n.r(t), n.d(t, { PageEditor: () => e3 }));
      var a = n(61023),
        r = n(38711),
        l = n(31617),
        i = n(66614),
        s = n(63171),
        o = n(23461),
        c = n(91746),
        d = n(78735),
        u = n(68502),
        g = n(3005),
        m = n(77956),
        p = n(57737),
        h = n(36906),
        f = n(26908),
        x = n(71694),
        b = n(34518);
      let v = "data-editor-overlay-root";
      function y(e) {
        if (!e || "inherit" === e) return null;
        let t = e.match(/^(\d+)/);
        return t ? parseInt(t[1], 10) : null;
      }
      function w(e) {
        let t = new Map(),
          n = "",
          a = 0;
        for (let r = 0; r < e.length; r++) {
          let l = e[r];
          if ("(" === l) a++;
          else if (")" === l) a--;
          else if (";" === l && 0 === a) {
            (j(n.trim(), t), (n = ""));
            continue;
          }
          n += l;
        }
        return (j(n.trim(), t), t);
      }
      function j(e, t) {
        if (!e) return;
        let n = e.indexOf(":");
        if (n <= 0) return;
        let a = e.substring(0, n).trim().toLowerCase(),
          r = e.substring(n + 1).trim();
        a && r && t.set(a, r);
      }
      function N(e) {
        var t, n, a, r;
        let l,
          { placeholderHtml: i, svgs: s } = S(e),
          o = new DOMParser().parseFromString("<body>".concat(i, "</body>"), "text/html"),
          c = o.body,
          d = [],
          u = 0,
          g = new Set(),
          m = (e, t) => {
            let n;
            if (e && !g.has(e)) return (g.add(e), e);
            do n = "".concat(t, "-").concat(u++);
            while (g.has(n));
            return (g.add(n), n);
          },
          p = new Set();
        for (let e of c.querySelectorAll(".image-slot")) {
          p.add(e);
          let n = m(e.getAttribute("data-editable-id"), "slot"),
            a = e.getAttribute("data-slot-type") || "main",
            r = e.getAttribute("data-slot-label") || "Image area",
            l = e.getAttribute("data-search-query") || void 0,
            i = e.getAttribute("style") || "",
            s = w(i),
            o = (s.get("background-image") || "").match(/url\(['"]?([^'")\s]+)['"]?\)/i),
            c = (null == o ? void 0 : o[1]) || "",
            u =
              c &&
              (c.includes("picsum.photos") ||
                c.includes("placeholder") ||
                c.includes("via.placeholder.com") ||
                c.includes("placehold.co") ||
                c.includes("dummyimage.com"))
                ? ""
                : c,
            g = s.get("background-position") || "center",
            h = s.get("background-size") || "cover",
            f = E(i),
            x = k(i),
            b = s.get("width"),
            v = s.get("height");
          (e.setAttribute("data-editable-id", n),
            d.push({
              id: n,
              type: "image-slot",
              originalValue: u,
              currentValue: u,
              selector: (null == (t = e.outerHTML.match(/^<div[^>]*>/)) ? void 0 : t[0]) || e.outerHTML,
              slotType: a,
              slotLabel: r,
              searchQuery: l,
              backgroundPosition: g,
              originalBackgroundPosition: g,
              backgroundSize: h,
              originalBackgroundSize: h,
              translateX: f.x,
              translateY: f.y,
              originalTranslateX: f.x,
              originalTranslateY: f.y,
              width: b,
              originalWidth: b,
              height: v,
              originalHeight: v,
              rotate: x,
              originalRotate: x,
            }));
        }
        for (let e of c.querySelectorAll("img[src]")) {
          if (e.closest(".image-slot")) continue;
          let t = e.getAttribute("src") || "";
          if (t.startsWith("data:") || t.length <= 10) continue;
          let n = m(e.getAttribute("data-editable-id"), "img"),
            a = e.getAttribute("style") || "",
            r = w(a),
            l = r.get("border-radius"),
            i = r.get("opacity"),
            s = r.get("object-fit"),
            o = r.get("width"),
            c = r.get("height"),
            u = E(a),
            g = k(a);
          (e.setAttribute("data-editable-id", n),
            p.add(e),
            d.push({
              id: n,
              type: "image",
              originalValue: t,
              currentValue: t,
              selector: e.outerHTML,
              borderRadius: l,
              originalBorderRadius: l,
              opacity: i,
              originalOpacity: i,
              objectFit: s,
              originalObjectFit: s,
              translateX: u.x,
              translateY: u.y,
              originalTranslateX: u.x,
              originalTranslateY: u.y,
              width: o,
              originalWidth: o,
              height: c,
              originalHeight: c,
              rotate: g,
              originalRotate: g,
            }));
        }
        let h = new Set();
        for (let e of d) "image-slot" === e.type && e.currentValue && h.add(e.currentValue);
        for (let e of c.querySelectorAll("*")) {
          if (p.has(e) || e.classList.contains("image-slot")) continue;
          let t = (e.getAttribute("style") || "").match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i);
          if (!t) continue;
          let n = t[1];
          if (n.startsWith("data:") || n.length <= 10 || h.has(n)) continue;
          let a = m(e.getAttribute("data-editable-id"), "bg");
          (e.setAttribute("data-editable-id", a),
            p.add(e),
            d.push({ id: a, type: "image", originalValue: n, currentValue: n, selector: t[0] }));
        }
        let f = c.querySelectorAll('span[data-richtext="true"], span[data-editable-id]'),
          x = new Set();
        for (let e of f) {
          if (p.has(e)) continue;
          let t = e.innerHTML;
          if (!/<(b|i|em|strong|span)\b/i.test(t)) continue;
          let a = (null == (n = e.textContent) ? void 0 : n.trim()) || "";
          if (a.length < 1) continue;
          let r = e.getAttribute("data-editable-id");
          if (r && d.some((e) => e.id === r)) continue;
          let l = m(r, "text"),
            i = e.getAttribute("style") || "",
            s = w(i),
            o = E(i);
          (e.setAttribute("data-editable-id", l),
            p.add(e),
            x.add(e),
            d.push({
              id: l,
              type: "text",
              originalValue: t,
              currentValue: t,
              richHtml: !0,
              selector: a,
              context: e.outerHTML,
              fontFamily: s.get("font-family"),
              originalFontFamily: s.get("font-family"),
              fontSize: s.get("font-size"),
              originalFontSize: s.get("font-size"),
              color: s.get("color"),
              originalColor: s.get("color"),
              textAlign: s.get("text-align"),
              originalTextAlign: s.get("text-align"),
              fontWeight: s.get("font-weight"),
              originalFontWeight: s.get("font-weight"),
              lineHeight: s.get("line-height"),
              originalLineHeight: s.get("line-height"),
              letterSpacing: s.get("letter-spacing"),
              originalLetterSpacing: s.get("letter-spacing"),
              marginTop: s.get("margin-top"),
              originalMarginTop: s.get("margin-top"),
              marginBottom: s.get("margin-bottom"),
              originalMarginBottom: s.get("margin-bottom"),
              marginLeft: s.get("margin-left"),
              originalMarginLeft: s.get("margin-left"),
              marginRight: s.get("margin-right"),
              originalMarginRight: s.get("margin-right"),
              translateX: o.x,
              originalTranslateX: o.x,
              translateY: o.y,
              originalTranslateY: o.y,
            }));
        }
        let b = o.createTreeWalker(c, NodeFilter.SHOW_TEXT, {
          acceptNode(e) {
            var t;
            if (((null == (t = e.textContent) ? void 0 : t.trim()) || "").length < 1) return NodeFilter.FILTER_REJECT;
            let n = e.parentElement;
            if (!n) return NodeFilter.FILTER_REJECT;
            let a = n.tagName.toLowerCase();
            return "script" === a || "style" === a ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
          },
        });
        for (; null !== (l = b.nextNode()); ) {
          let e = (null == (a = l.textContent) ? void 0 : a.trim()) || "";
          if (
            e.length < 1 ||
            (function (e) {
              let t =
                  /^[a-z][a-z-]*\s*:\s*[^;]+;?$/.test(e) ||
                  (e.includes(":") && e.includes(";") && e.split(";").length > 2) ||
                  /^\s*[\d.]+\s*(px|em|rem|%|vh|vw|pt|cm|mm)\s*$/.test(e),
                n =
                  e.startsWith("function") ||
                  e.includes("var ") ||
                  e.includes("const ") ||
                  e.includes("let ") ||
                  e.includes("=>") ||
                  /^\s*\{[\s\S]*\}\s*$/.test(e),
                a =
                  e.includes("\uD83D\uDCF7") ||
                  e.includes("이미지 영역") ||
                  e.includes("Image area") ||
                  "..." === e ||
                  /^[\s\n\r]+$/.test(e),
                r = /^(&[a-z]+;|\s)+$/i.test(e);
              return t || n || a || r;
            })(e)
          )
            continue;
          let t = l.parentElement;
          if (
            !t ||
            (function (e, t) {
              let n = e;
              for (; n; ) {
                if (t.has(n)) return !0;
                n = n.parentElement;
              }
              return !1;
            })(t, x) ||
            (t.hasAttribute("data-editable-id") && p.has(t))
          )
            continue;
          let n = t.getAttribute("data-editable-id");
          if (n && "span" === t.tagName.toLowerCase() && d.some((e) => e.id === n)) continue;
          let r = (function (e) {
              let t = e;
              for (; t; ) {
                if (t.hasAttribute("style")) return t;
                t = t.parentElement;
              }
              return null;
            })(t),
            i = (null == r ? void 0 : r.getAttribute("style")) || "",
            s = w(i),
            c = E(i),
            u = m(n, "text"),
            g = t.tagName.toLowerCase();
          if (("span" === g && !p.has(t)) || (n && "span" === g)) (t.setAttribute("data-editable-id", u), p.add(t));
          else {
            let e = o.createElement("span");
            (e.setAttribute("data-editable-id", u), t.insertBefore(e, l), e.appendChild(l), p.add(e));
          }
          let h = (t.closest("div") || t).outerHTML;
          d.push({
            id: u,
            type: "text",
            originalValue: e,
            currentValue: e,
            selector: e,
            context: h.length > 300 ? h.substring(0, 300) : h,
            fontFamily: s.get("font-family"),
            originalFontFamily: s.get("font-family"),
            fontSize: s.get("font-size"),
            originalFontSize: s.get("font-size"),
            color: s.get("color"),
            originalColor: s.get("color"),
            textAlign: s.get("text-align"),
            originalTextAlign: s.get("text-align"),
            fontWeight: s.get("font-weight"),
            originalFontWeight: s.get("font-weight"),
            lineHeight: s.get("line-height"),
            originalLineHeight: s.get("line-height"),
            letterSpacing: s.get("letter-spacing"),
            originalLetterSpacing: s.get("letter-spacing"),
            marginTop: s.get("margin-top"),
            originalMarginTop: s.get("margin-top"),
            marginBottom: s.get("margin-bottom"),
            originalMarginBottom: s.get("margin-bottom"),
            marginLeft: s.get("margin-left"),
            originalMarginLeft: s.get("margin-left"),
            marginRight: s.get("margin-right"),
            originalMarginRight: s.get("margin-right"),
            translateX: c.x,
            originalTranslateX: c.x,
            translateY: c.y,
            originalTranslateY: c.y,
          });
        }
        let y = new Set();
        for (let e of c.querySelectorAll("div")) {
          if (p.has(e) || y.has(e) || "true" === e.getAttribute(v) || e.classList.contains("image-slot")) continue;
          let t = e.getAttribute("style") || "",
            n = w(t),
            a = "absolute" === n.get("position"),
            l = n.has("background-color") || n.has("background"),
            i = n.has("border");
          if (!a && !l && !i) continue;
          let s = null !== e.querySelector("div");
          if (
            (a && !s && ((null == (r = e.textContent) ? void 0 : r.trim()) || "").length >= 3 && !l && !i) ||
            (a && s && !n.has("width") && !n.has("height")) ||
            (!a && !l && !i)
          )
            continue;
          let o = m(e.getAttribute("data-editable-id"), "div");
          (e.setAttribute("data-editable-id", o), p.add(e), y.add(e));
          let c = n.get("background-color"),
            u = n.get("width"),
            g = n.get("height"),
            h = E(t),
            f = k(t);
          d.push({
            id: o,
            type: "div",
            originalValue: e.outerHTML,
            currentValue: e.outerHTML,
            selector: e.outerHTML,
            backgroundColor: c,
            width: u,
            height: g,
            originalWidth: u,
            originalHeight: g,
            translateX: h.x,
            translateY: h.y,
            originalTranslateX: h.x,
            originalTranslateY: h.y,
            rotate: f,
            originalRotate: f,
          });
        }
        for (let e = 0; e < s.length; e++) {
          let t,
            n = s[e],
            a = n.match(/data-editable-id="([^"]+)"/),
            r = (null == a ? void 0 : a[1]) || null,
            l = m(r, "svg"),
            i = n.match(/\bstyle="([^"]*)"/),
            o = (null == i ? void 0 : i[1]) || "",
            c = E(o),
            u = k(o),
            g = w(o),
            p = n.match(/\bwidth="([^"]*)"/),
            h = n.match(/\bheight="([^"]*)"/),
            f = (null == p ? void 0 : p[1]) || void 0,
            x = (null == h ? void 0 : h[1]) || void 0;
          ((t = r ? n : n.replace(/^<svg/, '<svg data-editable-id="'.concat(l, '"'))),
            (s[e] = t),
            d.push({
              id: l,
              type: "div",
              originalValue: t,
              currentValue: t,
              selector: t,
              width: f,
              height: x,
              originalWidth: f,
              originalHeight: x,
              translateX: c.x,
              translateY: c.y,
              originalTranslateX: c.x,
              originalTranslateY: c.y,
              rotate: u,
              originalRotate: u,
              backgroundColor: g.get("background-color"),
            }));
        }
        let j = c.innerHTML;
        return {
          elements: d,
          html: (j = (j = j.replace(/\s*data-richtext="[^"]*"/gi, "")).replace(
            /<div data-svg-placeholder="(\d+)"><\/div>/gi,
            (e, t) => s[parseInt(t, 10)] || "",
          )),
        };
      }
      function E(e) {
        let t = e.match(/transform:\s*translate\(([^,]+),\s*([^)]+)\)/i);
        return t ? { x: t[1].trim(), y: t[2].trim() } : {};
      }
      function k(e) {
        let t = e.match(/rotate\(([^)]+)\)/i);
        if (t) return t[1].trim();
      }
      function S(e, t) {
        let n,
          a = [],
          r = /<svg[\s\S][\s >]/gi,
          l = "",
          i = 0;
        for (; null !== (n = r.exec(e)); ) {
          let s = n.index,
            o = 1,
            c = s + n[0].length,
            d = -1;
          for (; o > 0 && c < e.length; ) {
            let t = e.indexOf("<svg", c),
              n = e.indexOf("</svg>", c);
            if (-1 === n) break;
            if (-1 !== t && t < n) {
              let n = e[t + 4];
              ((" " === n || ">" === n || "/" === n || "\n" === n || "	" === n) && o++, (c = t + 5));
            } else {
              if (0 == --o) {
                d = n + 6;
                break;
              }
              c = n + 6;
            }
          }
          if (-1 === d) continue;
          let u = e.substring(s, d),
            g = a.length;
          a.push(u);
          let m = t ? t(g, u) : '<div data-svg-placeholder="'.concat(g, '"></div>');
          ((l += e.substring(i, s) + m), (i = d), (r.lastIndex = d));
        }
        return { placeholderHtml: (l += e.substring(i)), svgs: a };
      }
      function C(e) {
        let t = new Set();
        for (let n of e)
          if (n.fontFamily && "inherit" !== n.fontFamily) {
            let e = n.fontFamily.split(",")[0].trim().replace(/['"]/g, "");
            e && t.add(e);
          }
        if (0 === t.size) return "";
        let n = [],
          a = [];
        for (let e of t) {
          let t = b.R8.find((t) => t.family === e || t.name === e || t.id === e);
          if (t)
            if (t.googleFontModule) {
              let e = t.family.replace(/ /g, "+"),
                a = t.weights.join(";");
              n.push(
                '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family='
                  .concat(e, ":wght@")
                  .concat(a, '&display=swap">'),
              );
            } else
              t.customFontUrl &&
                (t.customFontUrl.endsWith(".css")
                  ? n.push('<link rel="stylesheet" href="'.concat(t.customFontUrl, '">'))
                  : a.push(
                      "\n            @font-face {\n              font-family: '"
                        .concat(t.family, "';\n              src: url('")
                        .concat(t.customFontUrl, "') format('")
                        .concat(
                          t.customFontUrl.endsWith(".woff2") ? "woff2" : "woff",
                          "');\n              font-weight: 100 900;\n              font-style: normal;\n              font-display: swap;\n            }\n          ",
                        ),
                    ));
        }
        let r = "";
        return (
          n.length > 0 && (r += n.join("\n")),
          a.length > 0 && (r += "<style>".concat(a.join("\n"), "</style>")),
          r
        );
      }
      function A(e) {
        let { placeholderHtml: t, svgs: n } = S(e),
          a = n.map((e) => e.replace(/\s*data-editable-id="[^"]*"/g, "")),
          r = new DOMParser().parseFromString("<body>".concat(t, "</body>"), "text/html").body;
        (r.querySelectorAll("span[data-editable-id]").forEach((e) => {
          if (/<[a-z]/i.test(e.innerHTML))
            (e.removeAttribute("data-editable-id"),
              e.removeAttribute("data-richtext"),
              e.setAttribute("data-richtext", "true"));
          else {
            var t;
            e.hasAttribute("style") && (null == (t = e.getAttribute("style")) ? void 0 : t.trim())
              ? e.removeAttribute("data-editable-id")
              : e.replaceWith(...e.childNodes);
          }
        }),
          r.querySelectorAll("[data-editable-id]").forEach((e) => {
            e.removeAttribute("data-editable-id");
          }),
          r.querySelectorAll("[data-user-uploaded]").forEach((e) => {
            e.removeAttribute("data-user-uploaded");
          }));
        let l = r.innerHTML;
        return l.replace(/<div data-svg-placeholder="(\d+)"><\/div>/gi, (e, t) => a[parseInt(t, 10)] || "");
      }
      function R(e, t) {
        let n = new Map(),
          { placeholderHtml: a, svgs: r } = S(e, (e, t) => {
            let a = t.match(/data-editable-id="([^"]+)"/),
              r = (null == a ? void 0 : a[1]) || "__svg_".concat(e);
            return (n.set(r, t), '<div data-svg-placeholder="'.concat(r, '" data-editable-id="').concat(r, '"></div>'));
          }),
          l = new DOMParser().parseFromString("<body>".concat(a, "</body>"), "text/html").body;
        for (let e of t) {
          let t = l.querySelector('[data-editable-id="'.concat(e.id, '"]'));
          if (t) {
            var i, s, o, c;
            if (e.deleted) {
              (n.delete(e.id), t.remove());
              continue;
            }
            if (t.hasAttribute("data-svg-placeholder")) {
              let t = n.get(e.id);
              t &&
                n.set(
                  e.id,
                  (function (e, t) {
                    let n = e,
                      a = t.translateX,
                      r = t.translateY,
                      l = r && "0px" !== r && "0" !== r,
                      i = t.rotate && "0deg" !== t.rotate && "0" !== t.rotate,
                      s = [];
                    if (
                      (((a && "0px" !== a && "0" !== a) || l) &&
                        s.push("translate(".concat(a || "0px", ", ").concat(r || "0px", ")")),
                      i && s.push("rotate(".concat(t.rotate, ")")),
                      s.length > 0)
                    ) {
                      let e = "transform: ".concat(s.join(" "));
                      n = /transform\s*:/.test(n)
                        ? n.replace(/transform\s*:\s*[^;"]+/g, e)
                        : /\bstyle="/.test(n)
                          ? n.replace(/\bstyle="/, 'style="'.concat(e, "; "))
                          : n.replace(/^<svg/, '<svg style="'.concat(e, '"'));
                    }
                    return (
                      t.width &&
                        t.width !== t.originalWidth &&
                        /\bwidth="/.test(n) &&
                        (n = n.replace(/\bwidth="[^"]*"/, 'width="'.concat(t.width, '"'))),
                      t.height &&
                        t.height !== t.originalHeight &&
                        /\bheight="/.test(n) &&
                        (n = n.replace(/\bheight="[^"]*"/, 'height="'.concat(t.height, '"'))),
                      n
                    );
                  })(t, e),
                );
              continue;
            }
            "image-slot" === e.type
              ? (function (e, t) {
                  if (t.currentValue !== t.originalValue) {
                    let n = t.backgroundSize || "cover",
                      a = t.backgroundPosition || "center";
                    (e.style.setProperty("background-image", "url('".concat(t.currentValue, "')")),
                      e.style.setProperty("background-size", n),
                      e.style.setProperty("background-position", a),
                      e.style.setProperty("background-repeat", "no-repeat"));
                  } else
                    (t.backgroundPosition &&
                      t.backgroundPosition !== t.originalBackgroundPosition &&
                      e.style.setProperty("background-position", t.backgroundPosition),
                      t.backgroundSize &&
                        t.backgroundSize !== t.originalBackgroundSize &&
                        e.style.setProperty("background-size", t.backgroundSize));
                  (t.borderRadius &&
                    "inherit" !== t.borderRadius &&
                    t.borderRadius !== t.originalBorderRadius &&
                    e.style.setProperty("border-radius", t.borderRadius),
                    t.opacity &&
                      "inherit" !== t.opacity &&
                      t.opacity !== t.originalOpacity &&
                      e.style.setProperty("opacity", t.opacity),
                    t.width && t.width !== t.originalWidth && e.style.setProperty("width", t.width),
                    t.height && t.height !== t.originalHeight && e.style.setProperty("height", t.height),
                    T(e, t),
                    t.userUploaded &&
                      !e.hasAttribute("data-user-uploaded") &&
                      e.setAttribute("data-user-uploaded", "true"));
                })(t, e)
              : "image" === e.type
                ? ((i = t),
                  (s = e).currentValue !== s.originalValue &&
                    ("img" === i.tagName.toLowerCase()
                      ? i.setAttribute("src", s.currentValue)
                      : i.style.setProperty("background-image", "url('".concat(s.currentValue, "')"))),
                  s.borderRadius &&
                    "inherit" !== s.borderRadius &&
                    s.borderRadius !== s.originalBorderRadius &&
                    i.style.setProperty("border-radius", s.borderRadius),
                  s.opacity &&
                    "inherit" !== s.opacity &&
                    s.opacity !== s.originalOpacity &&
                    i.style.setProperty("opacity", s.opacity),
                  s.objectFit &&
                    "inherit" !== s.objectFit &&
                    s.objectFit !== s.originalObjectFit &&
                    i.style.setProperty("object-fit", s.objectFit),
                  s.width && s.width !== s.originalWidth && i.style.setProperty("width", s.width),
                  s.height && s.height !== s.originalHeight && i.style.setProperty("height", s.height),
                  T(i, s))
                : "text" === e.type
                  ? (function (e, t) {
                      let n = t.currentValue !== t.originalValue,
                        a = t.fontFamily && "inherit" !== t.fontFamily && t.fontFamily !== t.originalFontFamily,
                        r = t.fontSize && "inherit" !== t.fontSize && t.fontSize !== t.originalFontSize,
                        l = t.color && "inherit" !== t.color && t.color !== t.originalColor,
                        i = t.textAlign && "inherit" !== t.textAlign && t.textAlign !== t.originalTextAlign,
                        s = t.fontWeight && t.fontWeight !== t.originalFontWeight,
                        o = "inherit" === t.fontWeight && t.originalFontWeight && "inherit" !== t.originalFontWeight,
                        c = t.lineHeight && "inherit" !== t.lineHeight && t.lineHeight !== t.originalLineHeight,
                        d =
                          t.letterSpacing &&
                          "inherit" !== t.letterSpacing &&
                          t.letterSpacing !== t.originalLetterSpacing,
                        u = t.marginTop && "inherit" !== t.marginTop && t.marginTop !== t.originalMarginTop,
                        g = t.marginBottom && "inherit" !== t.marginBottom && t.marginBottom !== t.originalMarginBottom,
                        m = t.marginLeft && "inherit" !== t.marginLeft && t.marginLeft !== t.originalMarginLeft,
                        p = t.marginRight && "inherit" !== t.marginRight && t.marginRight !== t.originalMarginRight,
                        h = t.width && t.width !== t.originalWidth,
                        f = t.height && t.height !== t.originalHeight,
                        x = (t.richHtml ? t.currentValue.replace(/<[^>]*>/g, "") : t.currentValue).includes("\n"),
                        b = t.translateX,
                        v = t.translateY,
                        y = b && "0px" !== b && "0" !== b,
                        w = v && "0px" !== v && "0" !== v,
                        j = t.rotate && "0deg" !== t.rotate && "0" !== t.rotate,
                        N = u || g || m || p || y || w || j || h || f,
                        E = a || r || l || i || s || o || c || d || u || g || m || p || h || f || y || w || j || N || x;
                      (n || E) &&
                        (a && e.style.setProperty("font-family", t.fontFamily),
                        r && e.style.setProperty("font-size", t.fontSize),
                        l && !t.richHtml && e.style.setProperty("color", t.color),
                        i && e.style.setProperty("text-align", t.textAlign),
                        s && !o && e.style.setProperty("font-weight", t.fontWeight),
                        o && e.style.removeProperty("font-weight"),
                        c && e.style.setProperty("line-height", t.lineHeight),
                        d && e.style.setProperty("letter-spacing", t.letterSpacing),
                        u && e.style.setProperty("margin-top", t.marginTop),
                        g && e.style.setProperty("margin-bottom", t.marginBottom),
                        m && e.style.setProperty("margin-left", t.marginLeft),
                        p && e.style.setProperty("margin-right", t.marginRight),
                        x && e.style.setProperty("white-space", "pre-wrap"),
                        h && e.style.setProperty("width", t.width),
                        f && e.style.setProperty("height", t.height),
                        T(e, t),
                        N && e.style.setProperty("display", "inline-block"),
                        n && (t.richHtml ? (e.innerHTML = t.currentValue) : (e.textContent = t.currentValue)));
                    })(t, e)
                  : "div" === e.type &&
                    ((o = t),
                    (c = e).width && c.width !== c.originalWidth && o.style.setProperty("width", c.width),
                    c.height && c.height !== c.originalHeight && o.style.setProperty("height", c.height),
                    T(o, c));
          }
        }
        let d = l.innerHTML;
        return d.replace(/<div data-svg-placeholder="([^"]+)"[^>]*><\/div>/gi, (e, t) => n.get(t) || "");
      }
      function T(e, t) {
        let n = t.translateX,
          a = t.translateY,
          r = a && "0px" !== a && "0" !== a,
          l = t.rotate,
          i = [];
        (((n && "0px" !== n && "0" !== n) || r) &&
          i.push("translate(".concat(n || "0px", ", ").concat(a || "0px", ")")),
          l && "0deg" !== l && "0" !== l && i.push("rotate(".concat(l, ")")),
          i.length > 0 ? e.style.setProperty("transform", i.join(" ")) : e.style.removeProperty("transform"));
      }
      function z(e) {
        return !e || "0px" === e || "0" === e || "0deg" === e;
      }
      var H = n(33528);
      let F = "carousel-editor-history";
      function M(e) {
        return { baseHtml: e.baseHtml, elements: e.elements };
      }
      function L(e) {
        return { ...e, previewHtml: R(e.baseHtml, e.elements) };
      }
      function P(e) {
        return "bulk" === e.kind
          ? {
              kind: "bulk",
              states: Array.from(e.states.entries()).map((e) => {
                let [t, n] = e;
                return [t, M(n)];
              }),
            }
          : { kind: "single", pageIndex: e.pageIndex, state: M(e.state) };
      }
      function I(e) {
        return "bulk" === e.kind
          ? {
              kind: "bulk",
              states: new Map(
                e.states.map((e) => {
                  let [t, n] = e;
                  return [t, L(n)];
                }),
              ),
            }
          : { kind: "single", pageIndex: e.pageIndex, state: L(e.state) };
      }
      function D(e, t, n, a) {
        if (e)
          try {
            let r = JSON.stringify({
              generationId: e,
              past: t.slice(-15).map(P),
              future: n.slice(0, 15).map(P),
              pageStates: Array.from(a.entries()).map((e) => {
                let [t, n] = e;
                return [t, M(n)];
              }),
              timestamp: Date.now(),
            });
            sessionStorage.setItem(F, r);
          } catch (e) {}
      }
      var U = n(54126),
        O = n(83590),
        V = n(21749),
        W = n(75570);
      let X = [
          { value: "inherit", label: "inherit" },
          { value: "0", label: "0px" },
          { value: "4px", label: "4px" },
          { value: "8px", label: "8px" },
          { value: "12px", label: "12px" },
          { value: "16px", label: "16px" },
          { value: "24px", label: "24px" },
          { value: "50%", label: "Circle" },
        ],
        Y = [
          { value: "inherit", label: "inherit" },
          { value: "1", label: "100%" },
          { value: "0.9", label: "90%" },
          { value: "0.8", label: "80%" },
          { value: "0.7", label: "70%" },
          { value: "0.6", label: "60%" },
          { value: "0.5", label: "50%" },
          { value: "0.4", label: "40%" },
          { value: "0.3", label: "30%" },
        ],
        B = [
          { value: "inherit", label: "inherit" },
          { value: "cover", label: "Cover" },
          { value: "contain", label: "Contain" },
          { value: "fill", label: "Fill" },
          { value: "none", label: "None" },
        ],
        $ = [
          "#000000",
          "#FFFFFF",
          "#374151",
          "#6B7280",
          "#9CA3AF",
          "#EF4444",
          "#F97316",
          "#F59E0B",
          "#EAB308",
          "#84CC16",
          "#22C55E",
          "#10B981",
          "#14B8A6",
          "#06B6D4",
          "#0EA5E9",
          "#3B82F6",
          "#6366F1",
          "#8B5CF6",
          "#A855F7",
          "#D946EF",
          "#EC4899",
          "#F43F5E",
        ];
      var q = n(86193),
        _ = n(1824),
        G = n(92291),
        J = n(77177),
        K = n(8807);
      function Q(e) {
        var t;
        let {
            html: n,
            aspectRatio: l,
            selectedElementId: i,
            hoveredElementId: o,
            elements: c,
            onElementClick: d,
            onElementTextUpdate: u,
            onElementRichtextUpdate: g,
            onElementMove: m,
            onElementResize: p,
            onElementRotate: h,
            onElementDelete: f,
            isRefining: x = !1,
            flushRef: b,
          } = e,
          v = (0, s.useTranslations)("CarouselLab"),
          y = (0, r.useRef)(null),
          w = (0, r.useRef)(null),
          j = (0, r.useRef)(null),
          N = (0, r.useRef)(0.3),
          [E, k] = (0, r.useState)(!1);
        (0, r.useEffect)(() => {
          k("ontouchstart" in window || navigator.maxTouchPoints > 0);
        }, []);
        let S = J.F[l];
        (0, r.useEffect)(() => {
          if (b)
            return (
              (b.current = () => {
                let e = w.current;
                if (!e) return null;
                try {
                  let t = e.contentDocument;
                  if (!t) return null;
                  let n = t.querySelector('[data-editable-id][contenteditable="true"]');
                  if (!n) return null;
                  let a = n.getAttribute("data-editable-id");
                  if (!a) return null;
                  let r = n.cloneNode(!0);
                  (r.querySelectorAll("[data-editable-id]").forEach((e) => e.removeAttribute("data-editable-id")),
                    r.querySelectorAll("font").forEach((e) => {
                      var n;
                      let a = t.createElement("span");
                      (e.getAttribute("color") && (a.style.color = e.getAttribute("color") || ""),
                        e.getAttribute("size") &&
                          (a.style.fontSize =
                            { 1: "8px", 2: "10px", 3: "12px", 4: "14px", 5: "18px", 6: "24px", 7: "36px" }[
                              e.getAttribute("size") || ""
                            ] || e.getAttribute("size") + "px"),
                        e.getAttribute("face") && (a.style.fontFamily = e.getAttribute("face") || ""),
                        (a.innerHTML = e.innerHTML),
                        null == (n = e.parentNode) || n.replaceChild(a, e));
                    }),
                    r.querySelectorAll("[style]").forEach((e) => {
                      var t;
                      (e.style.removeProperty("cursor"),
                        (e.getAttribute("style") &&
                          (null == (t = e.getAttribute("style")) ? void 0 : t.trim()) !== "") ||
                          e.removeAttribute("style"));
                    }));
                  let l = r.innerHTML,
                    i = /<(span|b|i|em|strong)\b/i.test(l);
                  if (((n.contentEditable = "false"), (n.style.outline = ""), i))
                    return { id: a, value: l, isRich: !0 };
                  return { id: a, value: n.textContent || "", isRich: !1 };
                } catch (e) {
                  return null;
                }
              }),
              () => {
                b && (b.current = null);
              }
            );
        }, [b]);
        let A = (0, r.useMemo)(() => {
            let e = n;
            return (
              (e =
                (C(c) || "") +
                '<style>\n      html, body { overflow: hidden; }\n      img, .image-slot, [style*="background-image"] {\n        image-rendering: auto;\n      }\n    </style>' +
                e),
              (e = (0, K.y6)(e, {
                injectFontLoadScript: !0,
                bodyEndContent:
                  "\n<script>\n(function() {\n  // ===== Floating Toolbar for inline rich-text styling =====\n  var toolbar = document.createElement('div');\n  toolbar.id = 'rt-toolbar';\n  toolbar.style.cssText = 'display:none;position:fixed;z-index:99999;background:#1e1e2e;border-radius:12px;padding:10px 14px;box-shadow:0 8px 24px rgba(0,0,0,.4);gap:6px;align-items:center;pointer-events:auto;';\n  toolbar.innerHTML = [\n    '<button data-cmd=\"bold\" title=\"Bold\" style=\"font-weight:700\">B</button>',\n    '<button data-cmd=\"italic\" title=\"Italic\" style=\"font-style:italic\">I</button>',\n    '<span style=\"width:1px;height:24px;background:#555;margin:0 6px\"></span>',\n    '<button data-size=\"-\" title=\"Decrease size\" style=\"font-size:14px;line-height:1\">A-</button>',\n    '<button data-size=\"+\" title=\"Increase size\" style=\"font-size:18px;line-height:1;font-weight:600\">A+</button>',\n    '<span style=\"width:1px;height:24px;background:#555;margin:0 6px\"></span>',\n    '<label title=\"Text Color\" style=\"position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:8px;background:transparent;\">' +\n      '<span style=\"font-weight:700;font-size:17px;color:#fff;pointer-events:none\">A</span>' +\n      '<span id=\"rt-color-bar\" style=\"position:absolute;bottom:5px;left:8px;right:8px;height:3px;border-radius:2px;background:#ef4444;pointer-events:none\"></span>' +\n      '<input id=\"rt-color-input\" type=\"color\" value=\"#ef4444\" style=\"position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%\">' +\n    '</label>',\n    '<span style=\"width:1px;height:24px;background:#555;margin:0 6px\"></span>',\n  ].join('');\n  // Preset color dots\n  var presetColors = ['#EF4444','#F97316','#EAB308','#22C55E','#3B82F6','#8B5CF6','#EC4899','#FFFFFF','#000000'];\n  presetColors.forEach(function(c) {\n    toolbar.innerHTML += '<button data-color=\"' + c + '\" title=\"' + c + '\" style=\"width:26px;height:26px;border-radius:50%;background:' + c + ';border:2px solid ' + (c === '#000000' ? '#555' : c === '#FFFFFF' ? '#888' : 'transparent') + ';padding:0;margin:0 3px;flex-shrink:0\"></button>';\n  });\n  document.body.appendChild(toolbar);\n\n  // Style the toolbar buttons\n  var tbStyle = document.createElement('style');\n  tbStyle.textContent = '#rt-toolbar button[data-cmd],#rt-toolbar button[data-size]{background:transparent;border:none;color:#e0e0e0;width:40px;height:40px;border-radius:8px;cursor:pointer;font-size:17px;font-family:serif;display:flex;align-items:center;justify-content:center;}#rt-toolbar button[data-cmd]:hover,#rt-toolbar button[data-size]:hover{background:#444;}#rt-toolbar button[data-color]{cursor:pointer;transition:transform 0.1s;}#rt-toolbar button[data-color]:hover{transform:scale(1.25);}';\n  document.head.appendChild(tbStyle);\n\n  // Track toolbar position for persistence\n  var lastToolbarRect = null;\n\n  function showToolbar() {\n    var sel = window.getSelection();\n    if (!sel || sel.isCollapsed || !currentEditing) { toolbar.style.display = 'none'; lastToolbarRect = null; return; }\n    var range = sel.getRangeAt(0);\n    var rect = range.getBoundingClientRect();\n    if (rect.width === 0 && rect.height === 0) { toolbar.style.display = 'none'; lastToolbarRect = null; return; }\n    toolbar.style.display = 'flex';\n    var tbRect = toolbar.getBoundingClientRect();\n    var left = rect.left + rect.width / 2 - tbRect.width / 2;\n    if (left < 4) left = 4;\n    if (left + tbRect.width > window.innerWidth - 4) left = window.innerWidth - 4 - tbRect.width;\n    var top = Math.max(4, rect.top - tbRect.height - 8);\n    toolbar.style.left = left + 'px';\n    toolbar.style.top = top + 'px';\n    lastToolbarRect = { left: left, top: top };\n  }\n\n  function wrapSelectionWithSpan(styleObj) {\n    var sel = window.getSelection();\n    if (!sel || sel.isCollapsed || !currentEditing) return false;\n    var range = sel.getRangeAt(0);\n    // extractContents handles cross-element boundaries safely (unlike surroundContents)\n    var fragment = range.extractContents();\n    var span = document.createElement('span');\n    Object.keys(styleObj).forEach(function(k) { span.style[k] = styleObj[k]; });\n    span.appendChild(fragment);\n    range.insertNode(span);\n    // Merge adjacent/nested spans with same style to avoid deep nesting\n    mergeNestedSpans(span);\n    // Re-select the inserted content\n    var newRange = document.createRange();\n    newRange.selectNodeContents(span);\n    sel.removeAllRanges();\n    sel.addRange(newRange);\n    return true;\n  }\n\n  // Merge nested <span> children that only wrap a single child span\n  function mergeNestedSpans(el) {\n    el.querySelectorAll('span').forEach(function(child) {\n      // If child has exactly one child which is a span with same style property, merge\n      if (child.childNodes.length === 1 && child.firstChild.nodeType === 1 && child.firstChild.tagName === 'SPAN') {\n        var inner = child.firstChild;\n        // Copy inner styles onto the inner span (outer styles are inherited)\n        // Keep both separate to preserve specificity\n      }\n    });\n  }\n\n  function applyColor(color) {\n    var sel = window.getSelection();\n    if (!sel || sel.isCollapsed || !currentEditing) return;\n    if (!wrapSelectionWithSpan({ color: color })) {\n      // Last resort fallback\n      document.execCommand('foreColor', false, color);\n    }\n    showToolbar();\n  }\n\n  function applyFontSize(direction) {\n    var sel = window.getSelection();\n    if (!sel || sel.isCollapsed || !currentEditing) return;\n    var range = sel.getRangeAt(0);\n    var container = range.commonAncestorContainer;\n    if (container.nodeType === 3) container = container.parentNode;\n    var computed = window.getComputedStyle(container);\n    var currentSize = parseFloat(computed.fontSize) || 16;\n    var step = currentSize > 40 ? 4 : 2;\n    var newSize = direction === '+' ? currentSize + step : Math.max(8, currentSize - step);\n    wrapSelectionWithSpan({ fontSize: newSize + 'px' });\n    showToolbar();\n  }\n\n  toolbar.addEventListener('mousedown', function(e) {\n    e.preventDefault(); // prevent blur on the contentEditable\n    var btn = e.target.closest('[data-cmd]');\n    if (btn) {\n      var sel = window.getSelection();\n      var savedRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;\n      document.execCommand(btn.getAttribute('data-cmd'), false, null);\n      // Restore selection if execCommand collapsed it\n      if (savedRange && sel && sel.isCollapsed) {\n        sel.removeAllRanges();\n        sel.addRange(savedRange);\n      }\n      showToolbar();\n      return;\n    }\n    var sizeBtn = e.target.closest('[data-size]');\n    if (sizeBtn) {\n      applyFontSize(sizeBtn.getAttribute('data-size'));\n      return;\n    }\n    var colorBtn = e.target.closest('[data-color]');\n    if (colorBtn) {\n      var c = colorBtn.getAttribute('data-color');\n      applyColor(c);\n      // Update color input & bar\n      var ci = document.getElementById('rt-color-input');\n      var cb = document.getElementById('rt-color-bar');\n      if (ci) ci.value = c;\n      if (cb) cb.style.background = c;\n      return;\n    }\n  });\n\n  // Custom color input — save selection before color picker opens, restore on apply\n  var colorInput = null;\n  var savedSelectionForColor = null;\n  setTimeout(function() {\n    colorInput = document.getElementById('rt-color-input');\n    if (colorInput) {\n      // Save selection when color picker is about to open\n      colorInput.addEventListener('mousedown', function() {\n        var sel = window.getSelection();\n        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {\n          savedSelectionForColor = sel.getRangeAt(0).cloneRange();\n        }\n      });\n      colorInput.addEventListener('input', function(e) {\n        var c = e.target.value;\n        var cb = document.getElementById('rt-color-bar');\n        if (cb) cb.style.background = c;\n        // Restore selection if it was lost (color picker steals focus)\n        var sel = window.getSelection();\n        if (savedSelectionForColor && (!sel || sel.isCollapsed || sel.rangeCount === 0)) {\n          if (sel) {\n            sel.removeAllRanges();\n            sel.addRange(savedSelectionForColor);\n          }\n        }\n        applyColor(c);\n        savedSelectionForColor = null;\n      });\n    }\n  }, 100);\n\n  // Show toolbar on mouseup/touchend (after drag-select completes)\n  document.addEventListener('mouseup', function(e) {\n    if (!currentEditing) return;\n    if (e.target.closest('#rt-toolbar')) return;\n    // Small delay to let selection finalize\n    setTimeout(showToolbar, 10);\n  });\n  document.addEventListener('touchend', function(e) {\n    if (!currentEditing) return;\n    if (e.target.closest('#rt-toolbar')) return;\n    setTimeout(showToolbar, 10);\n  });\n\n  // Track selection changes to update toolbar position (keeps it floating while selection exists)\n  document.addEventListener('selectionchange', function() {\n    if (!currentEditing) return;\n    // Only update position if toolbar is already visible\n    if (toolbar.style.display === 'flex') {\n      showToolbar();\n    }\n  });\n\n  // ===== Touch device detection =====\n  var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;\n  var handleSize = isTouchDevice ? 22 : 10;\n  var handleOffset = isTouchDevice ? '-11px' : '-5px';\n  var rotHandleSize = isTouchDevice ? 24 : 12;\n\n  // ===== Drag & Drop + Click logic =====\n  var dragState = null;\n  var DRAG_THRESHOLD = isTouchDevice ? 10 : 5;\n  var SNAP_THRESHOLD = 6;\n  var guidesContainer = null;\n  var dragRafId = null;\n  var pendingDragEvent = null;\n\n  // Parse existing translate(x, y) from an element's transform style\n  function parseTranslate(el) {\n    var t = el.style.transform || '';\n    var m = t.match(/translate\\(([^,]+),\\s*([^)]+)\\)/);\n    if (m) return { x: parseFloat(m[1]) || 0, y: parseFloat(m[2]) || 0 };\n    return { x: 0, y: 0 };\n  }\n\n  // Create snap guide overlay\n  function ensureGuidesContainer() {\n    if (guidesContainer) return guidesContainer;\n    guidesContainer = document.createElement('div');\n    guidesContainer.id = 'dnd-guides';\n    guidesContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99998;';\n    document.body.appendChild(guidesContainer);\n    return guidesContainer;\n  }\n\n  function clearGuides() {\n    if (guidesContainer) guidesContainer.innerHTML = '';\n  }\n\n  function drawGuide(type, pos) {\n    var gc = ensureGuidesContainer();\n    var line = document.createElement('div');\n    if (type === 'v') {\n      line.style.cssText = 'position:fixed;top:0;width:1px;height:100%;background:#3b82f6;opacity:0.7;pointer-events:none;';\n      line.style.left = pos + 'px';\n    } else {\n      line.style.cssText = 'position:fixed;left:0;height:1px;width:100%;background:#3b82f6;opacity:0.7;pointer-events:none;';\n      line.style.top = pos + 'px';\n    }\n    gc.appendChild(line);\n  }\n\n  // Compute snap targets from other editable elements and page boundaries\n  function getSnapTargets(draggedEl) {\n    var targets = { x: [], y: [] };\n    var pageW = document.documentElement.clientWidth;\n    var pageH = document.documentElement.clientHeight;\n    // Page center\n    targets.x.push(pageW / 2);\n    targets.y.push(pageH / 2);\n    // Page edges\n    targets.x.push(0);\n    targets.x.push(pageW);\n    targets.y.push(0);\n    targets.y.push(pageH);\n\n    // Other editable elements\n    document.querySelectorAll('[data-editable-id]').forEach(function(el) {\n      if (el === draggedEl) return;\n      var r = el.getBoundingClientRect();\n      targets.x.push(r.left);\n      targets.x.push(r.left + r.width / 2);\n      targets.x.push(r.right);\n      targets.y.push(r.top);\n      targets.y.push(r.top + r.height / 2);\n      targets.y.push(r.bottom);\n    });\n    return targets;\n  }\n\n  // Find snap adjustments\n  function computeSnap(elRect, targets) {\n    var snapX = null, snapY = null;\n    var edges = [\n      { val: elRect.left, label: 'left' },\n      { val: elRect.left + elRect.width / 2, label: 'centerX' },\n      { val: elRect.right, label: 'right' },\n    ];\n    var yEdges = [\n      { val: elRect.top, label: 'top' },\n      { val: elRect.top + elRect.height / 2, label: 'centerY' },\n      { val: elRect.bottom, label: 'bottom' },\n    ];\n\n    var bestDx = SNAP_THRESHOLD + 1, bestDy = SNAP_THRESHOLD + 1;\n    for (var i = 0; i < edges.length; i++) {\n      for (var j = 0; j < targets.x.length; j++) {\n        var d = Math.abs(edges[i].val - targets.x[j]);\n        if (d < bestDx) { bestDx = d; snapX = { delta: targets.x[j] - edges[i].val, guide: targets.x[j] }; }\n      }\n    }\n    for (var i = 0; i < yEdges.length; i++) {\n      for (var j = 0; j < targets.y.length; j++) {\n        var d = Math.abs(yEdges[i].val - targets.y[j]);\n        if (d < bestDy) { bestDy = d; snapY = { delta: targets.y[j] - yEdges[i].val, guide: targets.y[j] }; }\n      }\n    }\n    return {\n      dx: bestDx <= SNAP_THRESHOLD && snapX ? snapX.delta : 0,\n      dy: bestDy <= SNAP_THRESHOLD && snapY ? snapY.delta : 0,\n      guideX: bestDx <= SNAP_THRESHOLD && snapX ? snapX.guide : null,\n      guideY: bestDy <= SNAP_THRESHOLD && snapY ? snapY.guide : null,\n    };\n  }\n\n  // Mouse/touch down on editable elements — start potential drag\n  function onPointerDown(e) {\n    if (e.target.closest('#rt-toolbar')) return;\n    if (e.target.closest('#dnd-guides')) return;\n    if (e.target.closest('[data-resize-handle]')) return;\n    if (e.target.closest('[data-rotate-handle]')) return;\n    // Don't start drag if we're in contentEditable mode\n    if (currentEditing) return;\n\n    var target = e.target.closest('[data-editable-id]');\n    if (!target) return;\n\n    var clientX = e.touches ? e.touches[0].clientX : e.clientX;\n    var clientY = e.touches ? e.touches[0].clientY : e.clientY;\n    var orig = parseTranslate(target);\n\n    // Force inline-block BEFORE capturing position so transform:translate works on inline <span>\n    var computed = window.getComputedStyle(target);\n    if (computed.display === 'inline') {\n      target.style.display = 'inline-block';\n    }\n\n    dragState = {\n      el: target,\n      id: target.getAttribute('data-editable-id'),\n      startX: clientX,\n      startY: clientY,\n      isDragging: false,\n      origTx: orig.x,\n      origTy: orig.y,\n      snapTargets: null,\n    };\n\n    e.preventDefault();\n  }\n\n  function processDragMove(clientX, clientY, shiftKey) {\n    if (!dragState) return;\n    var dx = clientX - dragState.startX;\n    var dy = clientY - dragState.startY;\n\n    if (!dragState.isDragging) {\n      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;\n      dragState.isDragging = true;\n      dragState.el.style.cursor = 'grabbing';\n      dragState.el.style.zIndex = '9999';\n      dragState.el.style.opacity = '0.9';\n      dragState.snapTargets = getSnapTargets(dragState.el);\n      window.parent.postMessage({ type: 'element-drag-start', id: dragState.id }, '*');\n    }\n\n    // Shift key: constrain to horizontal or vertical\n    if (shiftKey) {\n      if (Math.abs(dx) > Math.abs(dy)) { dy = 0; }\n      else { dx = 0; }\n    }\n\n    var newTx = dragState.origTx + dx;\n    var newTy = dragState.origTy + dy;\n\n    // Preserve existing rotate when dragging\n    var existingRotate = dragState.el.style.transform ? dragState.el.style.transform.match(/rotate\\([^)]+\\)/) : null;\n    var rotateSuffix = existingRotate ? ' ' + existingRotate[0] : '';\n    dragState.el.style.transform = 'translate(' + newTx + 'px, ' + newTy + 'px)' + rotateSuffix;\n\n    // Snap to guidelines\n    clearGuides();\n    if (dragState.snapTargets) {\n      var elRect = dragState.el.getBoundingClientRect();\n      var snap = computeSnap(elRect, dragState.snapTargets);\n      if (snap.dx !== 0 || snap.dy !== 0) {\n        newTx += snap.dx;\n        newTy += snap.dy;\n        dragState.el.style.transform = 'translate(' + newTx + 'px, ' + newTy + 'px)' + rotateSuffix;\n      }\n      if (snap.guideX !== null) drawGuide('v', snap.guideX);\n      if (snap.guideY !== null) drawGuide('h', snap.guideY);\n    }\n  }\n\n  function onPointerMove(e) {\n    if (!dragState) return;\n    e.preventDefault();\n\n    var clientX = e.touches ? e.touches[0].clientX : e.clientX;\n    var clientY = e.touches ? e.touches[0].clientY : e.clientY;\n\n    // Threshold check must be synchronous to avoid missed drag starts\n    if (!dragState.isDragging) {\n      var dx = clientX - dragState.startX;\n      var dy = clientY - dragState.startY;\n      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;\n    }\n\n    // RAF throttle: batch rapid moves into single paint frame\n    pendingDragEvent = { clientX: clientX, clientY: clientY, shiftKey: e.shiftKey };\n    if (!dragRafId) {\n      dragRafId = requestAnimationFrame(function() {\n        dragRafId = null;\n        if (pendingDragEvent && dragState) {\n          processDragMove(pendingDragEvent.clientX, pendingDragEvent.clientY, pendingDragEvent.shiftKey);\n          pendingDragEvent = null;\n        }\n      });\n    }\n  }\n\n  function onPointerUp(e) {\n    if (!dragState) return;\n    // Cancel any pending RAF to avoid stale updates\n    if (dragRafId) { cancelAnimationFrame(dragRafId); dragRafId = null; }\n    pendingDragEvent = null;\n    // Process any final position synchronously before sending to parent\n    var clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;\n    var clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;\n    if (dragState.isDragging) {\n      processDragMove(clientX, clientY, e.shiftKey);\n    }\n    var state = dragState;\n    dragState = null;\n\n    clearGuides();\n    state.el.style.cursor = '';\n    state.el.style.zIndex = '';\n    state.el.style.opacity = '';\n\n    if (state.isDragging) {\n      // Final position already applied by processDragMove above (with snap)\n      // Read final translate from the current transform\n      var finalPos = parseTranslate(state.el);\n      window.parent.postMessage({\n        type: 'element-move',\n        id: state.id,\n        translateX: Math.round(finalPos.x) + 'px',\n        translateY: Math.round(finalPos.y) + 'px',\n      }, '*');\n    } else {\n      // No drag happened — treat as click\n      window.parent.postMessage({ type: 'element-click', id: state.id }, '*');\n    }\n  }\n\n  // Cancel drag on pointer leaving iframe (edge case)\n  function onPointerCancel() {\n    if (!dragState) return;\n    if (dragRafId) { cancelAnimationFrame(dragRafId); dragRafId = null; }\n    pendingDragEvent = null;\n    clearGuides();\n    // Revert transform (preserve rotate)\n    var cancelRotateMatch = dragState.el.style.transform ? dragState.el.style.transform.match(/rotate\\([^)]+\\)/) : null;\n    var cancelRotateSuffix = cancelRotateMatch ? ' ' + cancelRotateMatch[0] : '';\n    dragState.el.style.transform = 'translate(' + dragState.origTx + 'px, ' + dragState.origTy + 'px)' + cancelRotateSuffix;\n    dragState.el.style.cursor = '';\n    dragState.el.style.zIndex = '';\n    dragState.el.style.opacity = '';\n    dragState = null;\n  }\n\n  document.addEventListener('mousedown', onPointerDown);\n  document.addEventListener('mousemove', onPointerMove);\n  document.addEventListener('mouseup', onPointerUp);\n  document.addEventListener('touchstart', onPointerDown, { passive: false });\n  document.addEventListener('touchmove', onPointerMove, { passive: false });\n  document.addEventListener('touchend', onPointerUp);\n  document.addEventListener('touchcancel', onPointerCancel);\n\n  // Click on empty space — deselect (only when not dragging)\n  document.addEventListener('click', function(e) {\n    if (e.target.closest('#rt-toolbar')) return;\n    if (e.target.closest('#dnd-guides')) return;\n    var target = e.target.closest('[data-editable-id]');\n    if (!target) {\n      if (currentEditing) {\n        currentEditing.blur();\n      }\n      window.parent.postMessage({ type: 'element-click', id: null }, '*');\n    }\n  });\n\n  // Handle double-click/double-tap on text elements for inline editing\n  var currentEditing = null;\n  var originalEditingContent = null;\n  var lastTapTime = 0;\n  var lastTapTarget = null;\n  document.addEventListener('touchend', function(e) {\n    var now = Date.now();\n    var target = e.target.closest('[data-editable-id]');\n    if (!target || target.tagName !== 'SPAN') { lastTapTime = 0; lastTapTarget = null; return; }\n    if (lastTapTarget === target && now - lastTapTime < 400) {\n      // Double-tap detected\n      lastTapTime = 0;\n      lastTapTarget = null;\n      e.preventDefault();\n      startInlineEdit(target);\n    } else {\n      lastTapTime = now;\n      lastTapTarget = target;\n    }\n  });\n\n  function startInlineEdit(target) {\n    // Exit previous editing if any\n    if (currentEditing && currentEditing !== target) {\n      currentEditing.contentEditable = 'false';\n      currentEditing.style.outline = '';\n    }\n    currentEditing = target;\n    originalEditingContent = target.innerHTML;\n    target.contentEditable = 'true';\n    target.focus();\n    target.style.outline = '2px solid #8b5cf6';\n    target.style.outlineOffset = '2px';\n    // Select all text for easy replacement\n    var range = document.createRange();\n    range.selectNodeContents(target);\n    var sel = window.getSelection();\n    sel.removeAllRanges();\n    sel.addRange(range);\n    setTimeout(showToolbar, 10);\n  }\n\n  document.addEventListener('dblclick', function(e) {\n    var target = e.target.closest('[data-editable-id]');\n    if (!target) return;\n    if (target.tagName !== 'SPAN') return;\n    e.preventDefault();\n    e.stopPropagation();\n    startInlineEdit(target);\n  });\n\n  // Helper: clean up inline HTML from contentEditable\n  function getCleanInnerHtml(el) {\n    // Clone to avoid mutating original\n    var clone = el.cloneNode(true);\n    // Remove data-editable-id from nested elements\n    clone.querySelectorAll('[data-editable-id]').forEach(function(n) {\n      n.removeAttribute('data-editable-id');\n    });\n    // Convert legacy <font> tags to <span style=\"...\"> (browser execCommand uses font tags)\n    clone.querySelectorAll('font').forEach(function(font) {\n      var span = document.createElement('span');\n      if (font.getAttribute('color')) span.style.color = font.getAttribute('color');\n      if (font.getAttribute('size')) {\n        var sizeMap = {'1':'8px','2':'10px','3':'12px','4':'14px','5':'18px','6':'24px','7':'36px'};\n        span.style.fontSize = sizeMap[font.getAttribute('size')] || font.getAttribute('size') + 'px';\n      }\n      if (font.getAttribute('face')) span.style.fontFamily = font.getAttribute('face');\n      span.innerHTML = font.innerHTML;\n      font.parentNode.replaceChild(span, font);\n    });\n    // Remove cursor:pointer styles that we injected\n    clone.querySelectorAll('[style]').forEach(function(n) {\n      n.style.removeProperty('cursor');\n      if (!n.getAttribute('style') || n.getAttribute('style').trim() === '') {\n        n.removeAttribute('style');\n      }\n    });\n    var html = clone.innerHTML;\n    // Normalize HTML formatting whitespace: collapse newlines + surrounding spaces\n    // into a single space. This prevents white-space:pre-wrap from making\n    // invisible HTML indentation visible when the user applies inline formatting.\n    html = html.replace(/\\s*\\n\\s*/g, ' ').replace(/\\s+$/g, '');\n    // Check if it has any real inline markup\n    var hasMarkup = /<(span|b|i|em|strong)\\b/i.test(html);\n    if (!hasMarkup) {\n      // No rich formatting — return plain text\n      return { isRich: false, value: el.textContent || '' };\n    }\n    return { isRich: true, value: html };\n  }\n\n  // End inline editing on blur (deferred to avoid premature exit during toolbar interactions)\n  var pendingBlurTimer = null;\n  document.addEventListener('focusout', function(e) {\n    if (!currentEditing) return;\n    // Check if focus moved to toolbar (relatedTarget)\n    if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('#rt-toolbar')) return;\n    var editingEl = currentEditing;\n    // Defer: toolbar mousedown fires after focusout, so wait to see if focus returns\n    if (pendingBlurTimer) clearTimeout(pendingBlurTimer);\n    pendingBlurTimer = setTimeout(function() {\n      pendingBlurTimer = null;\n      // Re-check: if currentEditing changed or focus returned, skip\n      if (currentEditing !== editingEl) return;\n      if (document.activeElement === editingEl) return;\n      if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#rt-toolbar')) return;\n      // Truly lost focus — end editing\n      currentEditing = null;\n      originalEditingContent = null;\n      editingEl.contentEditable = 'false';\n      editingEl.style.outline = '';\n      toolbar.style.display = 'none';\n\n      var id = editingEl.getAttribute('data-editable-id');\n      var result = getCleanInnerHtml(editingEl);\n      if (result.isRich) {\n        window.parent.postMessage({ type: 'element-richtext-update', id: id, value: result.value }, '*');\n      } else {\n        window.parent.postMessage({ type: 'element-text-update', id: id, value: result.value }, '*');\n      }\n    }, 150);\n  });\n\n  // End inline editing on Enter key (but allow Shift+Enter for newline)\n  document.addEventListener('keydown', function(e) {\n    if (!currentEditing) return;\n    if (e.key === 'Enter' && !e.shiftKey) {\n      e.preventDefault();\n      currentEditing.blur();\n    }\n    if (e.key === 'Escape') {\n      // Cancel editing - restore original content and visual state\n      if (originalEditingContent !== null) {\n        currentEditing.innerHTML = originalEditingContent;\n      }\n      currentEditing.contentEditable = 'false';\n      currentEditing.style.outline = '';\n      toolbar.style.display = 'none';\n      currentEditing = null;\n      originalEditingContent = null;\n    }\n  });\n\n  // ===== Resize / Rotate handle overlay =====\n  var selectionOverlay = null;\n  var resizeState = null;\n  var rotateState = null;\n\n  // All editable elements support resize/rotate (including text spans)\n  function isResizableElement(el) {\n    if (!el) return false;\n    return !!el.getAttribute('data-editable-id');\n  }\n\n  function removeSelectionOverlay() {\n    if (selectionOverlay && selectionOverlay.parentNode) {\n      selectionOverlay.parentNode.removeChild(selectionOverlay);\n    }\n    selectionOverlay = null;\n  }\n\n  function createSelectionOverlay(target) {\n    removeSelectionOverlay();\n    if (!target || !isResizableElement(target)) return;\n\n    var rect = target.getBoundingClientRect();\n    var id = target.getAttribute('data-editable-id');\n\n    var overlay = document.createElement('div');\n    overlay.id = 'sel-overlay';\n    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;box-sizing:border-box;border:2px solid #3b82f6;';\n    overlay.style.left = rect.left + 'px';\n    overlay.style.top = rect.top + 'px';\n    overlay.style.width = rect.width + 'px';\n    overlay.style.height = rect.height + 'px';\n\n    // Corner resize handles: nw, ne, se, sw\n    var corners = [\n      { name: 'nw', cursor: 'nwse-resize', left: '-5px', top: '-5px' },\n      { name: 'ne', cursor: 'nesw-resize', right: '-5px', top: '-5px' },\n      { name: 'se', cursor: 'nwse-resize', right: '-5px', bottom: '-5px' },\n      { name: 'sw', cursor: 'nesw-resize', left: '-5px', bottom: '-5px' },\n    ];\n\n    corners.forEach(function(c) {\n      var h = document.createElement('div');\n      h.setAttribute('data-resize-handle', c.name);\n      h.setAttribute('data-editable-target', id);\n      h.style.cssText = 'position:absolute;width:' + handleSize + 'px;height:' + handleSize + 'px;background:#fff;border:2px solid #3b82f6;box-sizing:border-box;pointer-events:auto;z-index:100000;border-radius:' + (isTouchDevice ? '50%' : '0') + ';';\n      h.style.cursor = c.cursor;\n      if (c.left !== undefined) h.style.left = handleOffset;\n      if (c.right !== undefined) h.style.right = handleOffset;\n      if (c.top !== undefined) h.style.top = handleOffset;\n      if (c.bottom !== undefined) h.style.bottom = handleOffset;\n      overlay.appendChild(h);\n    });\n\n    // Rotation handle - line + circle above top center\n    var rotLine = document.createElement('div');\n    rotLine.style.cssText = 'position:absolute;width:1px;height:30px;background:#3b82f6;left:calc(50% - 0.5px);top:-32px;pointer-events:none;';\n    overlay.appendChild(rotLine);\n\n    var rotHandle = document.createElement('div');\n    rotHandle.setAttribute('data-rotate-handle', 'true');\n    rotHandle.setAttribute('data-editable-target', id);\n    var rotHalf = rotHandleSize / 2;\n    rotHandle.style.cssText = 'position:absolute;width:' + rotHandleSize + 'px;height:' + rotHandleSize + 'px;border-radius:50%;background:#3b82f6;left:calc(50% - ' + rotHalf + 'px);top:-' + (32 + rotHandleSize) + 'px;pointer-events:auto;z-index:100000;cursor:crosshair;';\n    overlay.appendChild(rotHandle);\n\n    document.body.appendChild(overlay);\n    selectionOverlay = overlay;\n  }\n\n  function updateSelectionOverlayPosition(target) {\n    if (!selectionOverlay || !target) return;\n    var rect = target.getBoundingClientRect();\n    selectionOverlay.style.left = rect.left + 'px';\n    selectionOverlay.style.top = rect.top + 'px';\n    selectionOverlay.style.width = rect.width + 'px';\n    selectionOverlay.style.height = rect.height + 'px';\n  }\n\n  // Parse current rotation from element transform\n  function parseRotation(el) {\n    var t = el.style.transform || '';\n    var m = t.match(/rotate\\(([^)]+)\\)/);\n    if (m) return parseFloat(m[1]) || 0;\n    return 0;\n  }\n\n  // Shared: start resize from mouse or touch\n  function startResize(clientX, clientY, resizeHandle) {\n    var corner = resizeHandle.getAttribute('data-resize-handle');\n    var targetId = resizeHandle.getAttribute('data-editable-target');\n    var target = document.querySelector('[data-editable-id=\"' + targetId + '\"]');\n    if (!target) return;\n\n    var rect = target.getBoundingClientRect();\n    resizeState = {\n      el: target,\n      id: targetId,\n      corner: corner,\n      startX: clientX,\n      startY: clientY,\n      startW: rect.width,\n      startH: rect.height,\n      startLeft: rect.left,\n      startTop: rect.top,\n    };\n  }\n\n  // Shared: start rotate from mouse or touch\n  function startRotate(clientX, clientY, rotHandle) {\n    var targetId = rotHandle.getAttribute('data-editable-target');\n    var target = document.querySelector('[data-editable-id=\"' + targetId + '\"]');\n    if (!target) return;\n\n    var rect = target.getBoundingClientRect();\n    var cx = rect.left + rect.width / 2;\n    var cy = rect.top + rect.height / 2;\n    var startAngle = parseRotation(target);\n\n    rotateState = {\n      el: target,\n      id: targetId,\n      cx: cx,\n      cy: cy,\n      startAngle: startAngle,\n      initMouseAngle: Math.atan2(clientY - cy, clientX - cx) * 180 / Math.PI,\n    };\n  }\n\n  // Shared: process resize/rotate move\n  function processResizeRotateMove(clientX, clientY) {\n    var handled = false;\n    if (resizeState) {\n      var rs = resizeState;\n      var dx = clientX - rs.startX;\n      var dy = clientY - rs.startY;\n      var newW = rs.startW;\n      var newH = rs.startH;\n\n      if (rs.corner === 'se') {\n        newW = Math.max(20, rs.startW + dx);\n        newH = Math.max(20, rs.startH + dy);\n      } else if (rs.corner === 'sw') {\n        newW = Math.max(20, rs.startW - dx);\n        newH = Math.max(20, rs.startH + dy);\n      } else if (rs.corner === 'ne') {\n        newW = Math.max(20, rs.startW + dx);\n        newH = Math.max(20, rs.startH - dy);\n      } else if (rs.corner === 'nw') {\n        newW = Math.max(20, rs.startW - dx);\n        newH = Math.max(20, rs.startH - dy);\n      }\n\n      rs.el.style.width = Math.round(newW) + 'px';\n      rs.el.style.height = Math.round(newH) + 'px';\n      updateSelectionOverlayPosition(rs.el);\n      handled = true;\n    }\n\n    if (rotateState) {\n      var rot = rotateState;\n      var mouseAngle = Math.atan2(clientY - rot.cy, clientX - rot.cx) * 180 / Math.PI;\n      var angleDelta = mouseAngle - rot.initMouseAngle;\n      var newAngle = rot.startAngle + angleDelta;\n\n      var currentTransform = rot.el.style.transform || '';\n      var translateMatch = currentTransform.match(/translate\\([^)]+\\)/);\n      var translatePart = translateMatch ? translateMatch[0] : '';\n      var parts = [];\n      if (translatePart) parts.push(translatePart);\n      parts.push('rotate(' + Math.round(newAngle) + 'deg)');\n      rot.el.style.transform = parts.join(' ');\n      handled = true;\n    }\n    return handled;\n  }\n\n  // Shared: finalize resize/rotate\n  function finalizeResizeRotate() {\n    if (resizeRotateRafId) { cancelAnimationFrame(resizeRotateRafId); resizeRotateRafId = null; }\n    pendingResizeRotateEvent = null;\n    if (resizeState) {\n      var rs = resizeState;\n      window.parent.postMessage({\n        type: 'element-resize',\n        id: rs.id,\n        width: rs.el.style.width,\n        height: rs.el.style.height,\n      }, '*');\n      resizeState = null;\n    }\n\n    if (rotateState) {\n      var rot = rotateState;\n      var finalTransform = rot.el.style.transform || '';\n      var rotMatch = finalTransform.match(/rotate\\(([^)]+)\\)/);\n      var finalRotate = rotMatch ? rotMatch[1] : '0deg';\n      window.parent.postMessage({\n        type: 'element-rotate',\n        id: rot.id,\n        rotate: finalRotate,\n      }, '*');\n      rotateState = null;\n    }\n  }\n\n  // Resize handle mousedown\n  document.addEventListener('mousedown', function(e) {\n    var resizeHandle = e.target.closest('[data-resize-handle]');\n    if (!resizeHandle) return;\n    e.preventDefault();\n    e.stopPropagation();\n    startResize(e.clientX, e.clientY, resizeHandle);\n  });\n\n  // Rotation handle mousedown\n  document.addEventListener('mousedown', function(e) {\n    var rotHandle = e.target.closest('[data-rotate-handle]');\n    if (!rotHandle) return;\n    e.preventDefault();\n    e.stopPropagation();\n    startRotate(e.clientX, e.clientY, rotHandle);\n  });\n\n  // Resize handle touchstart\n  document.addEventListener('touchstart', function(e) {\n    var resizeHandle = e.target.closest('[data-resize-handle]');\n    if (!resizeHandle) return;\n    e.preventDefault();\n    e.stopPropagation();\n    var touch = e.touches[0];\n    startResize(touch.clientX, touch.clientY, resizeHandle);\n  }, { passive: false });\n\n  // Rotation handle touchstart\n  document.addEventListener('touchstart', function(e) {\n    var rotHandle = e.target.closest('[data-rotate-handle]');\n    if (!rotHandle) return;\n    e.preventDefault();\n    e.stopPropagation();\n    var touch = e.touches[0];\n    startRotate(touch.clientX, touch.clientY, rotHandle);\n  }, { passive: false });\n\n  // RAF throttle for resize/rotate\n  var resizeRotateRafId = null;\n  var pendingResizeRotateEvent = null;\n\n  function onResizeRotateMove(clientX, clientY, evt) {\n    if (!resizeState && !rotateState) return;\n    if (evt) evt.preventDefault();\n    pendingResizeRotateEvent = { clientX: clientX, clientY: clientY };\n    if (!resizeRotateRafId) {\n      resizeRotateRafId = requestAnimationFrame(function() {\n        resizeRotateRafId = null;\n        if (pendingResizeRotateEvent) {\n          processResizeRotateMove(pendingResizeRotateEvent.clientX, pendingResizeRotateEvent.clientY);\n          pendingResizeRotateEvent = null;\n        }\n      });\n    }\n  }\n\n  // Mouse move for resize/rotate\n  document.addEventListener('mousemove', function(e) {\n    if (resizeState || rotateState) {\n      onResizeRotateMove(e.clientX, e.clientY, e);\n    }\n  });\n\n  // Touch move for resize/rotate\n  document.addEventListener('touchmove', function(e) {\n    if (resizeState || rotateState) {\n      var touch = e.touches[0];\n      onResizeRotateMove(touch.clientX, touch.clientY, e);\n    }\n  }, { passive: false });\n\n  // Mouse up for resize/rotate\n  document.addEventListener('mouseup', function(e) {\n    finalizeResizeRotate();\n  });\n\n  // Touch end for resize/rotate\n  document.addEventListener('touchend', function(e) {\n    finalizeResizeRotate();\n  });\n\n  // Touch cancel for resize/rotate\n  document.addEventListener('touchcancel', function(e) {\n    resizeState = null;\n    rotateState = null;\n  });\n\n  // Handle highlight messages from parent\n  window.addEventListener('message', function(e) {\n    if (e.data && e.data.type === 'highlight') {\n      // Remove existing highlights\n      document.querySelectorAll('[data-editable-id]').forEach(function(el) {\n        el.style.outline = '';\n        el.style.outlineOffset = '';\n        el.style.transition = '';\n      });\n\n      removeSelectionOverlay();\n\n      // Add highlight to target element\n      if (e.data.id) {\n        var target = document.querySelector('[data-editable-id=\"' + e.data.id + '\"]');\n        if (target) {\n          target.style.outline = '3px solid #3b82f6';\n          target.style.outlineOffset = '2px';\n          target.style.transition = 'outline 0.15s ease';\n          // Show resize/rotate handles for non-text elements\n          createSelectionOverlay(target);\n        }\n      }\n    }\n  });\n\n  // ===== Incremental element updates from parent (avoids full doc.write) =====\n  function applyElementUpdate(el) {\n    if (!el || !el.id) return;\n    var target = document.querySelector('[data-editable-id=\"' + el.id + '\"]');\n    if (!target) return;\n\n    // Handle deletion / un-deletion\n    if (el.deleted) {\n      target.style.display = 'none';\n      return;\n    } else {\n      // Restore visibility if previously hidden by deletion\n      if (target.style.display === 'none') {\n        target.style.display = '';\n      }\n    }\n\n    // Handle text elements\n    if (el.elType === 'text') {\n      // Don't update text content if user is currently editing this element\n      if (currentEditing !== target) {\n        if (el.richHtml && el.currentValue) {\n          target.innerHTML = el.currentValue;\n        } else if (el.currentValue !== undefined) {\n          target.textContent = el.currentValue;\n        }\n      }\n      // Apply text styles (use !== undefined to allow falsy values like \"0\")\n      if (el.fontFamily !== undefined) target.style.fontFamily = el.fontFamily;\n      if (el.fontSize !== undefined) target.style.fontSize = el.fontSize;\n      if (el.color !== undefined) target.style.color = el.color;\n      if (el.textAlign !== undefined) target.style.textAlign = el.textAlign;\n      if (el.fontWeight !== undefined) target.style.fontWeight = el.fontWeight;\n      if (el.lineHeight !== undefined) target.style.lineHeight = el.lineHeight;\n      if (el.letterSpacing !== undefined) target.style.letterSpacing = el.letterSpacing;\n      // Ensure inline-block for text spans that have margins/transforms/sizing\n      if (el.marginTop || el.marginBottom || el.marginLeft || el.marginRight ||\n          el.translateX || el.translateY || el.width || el.height) {\n        target.style.display = 'inline-block';\n      }\n    }\n\n    // Handle image elements\n    if (el.elType === 'image' && el.currentValue) {\n      if (target.tagName === 'IMG') {\n        target.setAttribute('src', el.currentValue);\n      } else {\n        // Non-IMG image elements use background-image\n        target.style.backgroundImage = \"url('\" + el.currentValue + \"')\";\n        target.style.backgroundSize = el.backgroundSize || 'cover';\n        target.style.backgroundPosition = el.backgroundPosition || 'center';\n        target.style.backgroundRepeat = 'no-repeat';\n      }\n    }\n\n    // Handle image-slot elements (background-image divs)\n    if (el.elType === 'image-slot') {\n      if (el.currentValue) {\n        target.style.backgroundImage = \"url('\" + el.currentValue + \"')\";\n        target.style.backgroundRepeat = 'no-repeat';\n      }\n      if (el.backgroundSize !== undefined) target.style.backgroundSize = el.backgroundSize || 'cover';\n      if (el.backgroundPosition !== undefined) target.style.backgroundPosition = el.backgroundPosition || 'center';\n    }\n\n    // Apply common styles (use !== undefined to allow falsy values like \"0\")\n    if (el.borderRadius !== undefined) target.style.borderRadius = el.borderRadius;\n    if (el.opacity !== undefined) target.style.opacity = el.opacity;\n    if (el.elType === 'image' && el.objectFit !== undefined) target.style.objectFit = el.objectFit;\n    if (el.width !== undefined) target.style.width = el.width;\n    if (el.height !== undefined) target.style.height = el.height;\n\n    // Apply margins\n    if (el.marginTop !== undefined) target.style.marginTop = el.marginTop;\n    if (el.marginBottom !== undefined) target.style.marginBottom = el.marginBottom;\n    if (el.marginLeft !== undefined) target.style.marginLeft = el.marginLeft;\n    if (el.marginRight !== undefined) target.style.marginRight = el.marginRight;\n\n    // Apply transform (translate + rotate)\n    var parts = [];\n    if (el.translateX !== undefined || el.translateY !== undefined) {\n      var tx = el.translateX || '0px';\n      var ty = el.translateY || '0px';\n      parts.push('translate(' + tx + ', ' + ty + ')');\n    } else {\n      // Preserve existing translate\n      var existingTranslate = target.style.transform ? target.style.transform.match(/translate\\([^)]+\\)/) : null;\n      if (existingTranslate) parts.push(existingTranslate[0]);\n    }\n    if (el.rotate !== undefined) {\n      parts.push('rotate(' + (el.rotate || '0deg') + ')');\n    } else {\n      var existingRotate = target.style.transform ? target.style.transform.match(/rotate\\([^)]+\\)/) : null;\n      if (existingRotate) parts.push(existingRotate[0]);\n    }\n    if (parts.length > 0) {\n      target.style.transform = parts.join(' ');\n    }\n\n    // Update selection overlay if this element is selected\n    if (selectionOverlay) {\n      var overlayTargetId = selectionOverlay.querySelector('[data-editable-target]');\n      if (overlayTargetId && overlayTargetId.getAttribute('data-editable-target') === el.id) {\n        updateSelectionOverlayPosition(target);\n      }\n    }\n  }\n\n  window.addEventListener('message', function(e) {\n    if (!e.data) return;\n\n    if (e.data.type === 'update-element') {\n      applyElementUpdate(e.data.element);\n    }\n\n    if (e.data.type === 'update-elements' && Array.isArray(e.data.elements)) {\n      e.data.elements.forEach(function(el) {\n        applyElementUpdate(el);\n      });\n    }\n\n    if (e.data.type === 'update-font-css') {\n      // Inject or update font CSS\n      var existingFontStyle = document.getElementById('incremental-font-css');\n      if (existingFontStyle) {\n        existingFontStyle.textContent = e.data.css.replace(/<\\/?style[^>]*>/gi, '');\n      } else {\n        var fontStyle = document.createElement('style');\n        fontStyle.id = 'incremental-font-css';\n        fontStyle.textContent = e.data.css.replace(/<\\/?style[^>]*>/gi, '');\n        document.head.appendChild(fontStyle);\n      }\n    }\n  });\n\n  // Add hover effect styles + drag styles\n  var style = document.createElement('style');\n  style.textContent = `\n    [data-editable-id] {\n      cursor: grab !important;\n      transition: outline 0.15s ease, opacity 0.15s ease;\n    }\n    [data-editable-id]:hover {\n      outline: 2px dashed #94a3b8 !important;\n      outline-offset: 2px !important;\n    }\n    [data-editable-id]:active {\n      cursor: grabbing !important;\n    }\n    [data-editable-id][contenteditable=\"true\"] {\n      cursor: text !important;\n      outline: 2px solid #8b5cf6 !important;\n      outline-offset: 2px !important;\n      min-width: 20px;\n      min-height: 1em;\n    }\n  `;\n  document.head.appendChild(style);\n})();\n<\/script>\n",
              }))
            );
          }, [n]),
          R = (0, r.useRef)(null),
          T = (0, r.useRef)({
            onElementClick: d,
            onElementTextUpdate: u,
            onElementRichtextUpdate: g,
            onElementMove: m,
            onElementResize: p,
            onElementRotate: h,
          });
        (0, r.useEffect)(() => {
          T.current = {
            onElementClick: d,
            onElementTextUpdate: u,
            onElementRichtextUpdate: g,
            onElementMove: m,
            onElementResize: p,
            onElementRotate: h,
          };
        }, [d, u, g, m, p, h]);
        let z = (0, r.useRef)(c),
          H = (e, t) =>
            e.currentValue !== t.currentValue ||
            e.richHtml !== t.richHtml ||
            e.deleted !== t.deleted ||
            e.fontFamily !== t.fontFamily ||
            e.fontSize !== t.fontSize ||
            e.color !== t.color ||
            e.textAlign !== t.textAlign ||
            e.fontWeight !== t.fontWeight ||
            e.lineHeight !== t.lineHeight ||
            e.letterSpacing !== t.letterSpacing ||
            e.marginTop !== t.marginTop ||
            e.marginBottom !== t.marginBottom ||
            e.marginLeft !== t.marginLeft ||
            e.marginRight !== t.marginRight ||
            e.borderRadius !== t.borderRadius ||
            e.opacity !== t.opacity ||
            e.objectFit !== t.objectFit ||
            e.backgroundPosition !== t.backgroundPosition ||
            e.backgroundSize !== t.backgroundSize ||
            e.translateX !== t.translateX ||
            e.translateY !== t.translateY ||
            e.width !== t.width ||
            e.height !== t.height ||
            e.rotate !== t.rotate;
        (0, r.useEffect)(() => {
          let e = w.current;
          if (!(null == e ? void 0 : e.contentWindow) || R.current !== n) return;
          let t = z.current;
          z.current = c;
          let a = new Map(t.map((e) => [e.id, e])),
            r = [];
          for (let e of c) {
            let t = a.get(e.id);
            t && H(e, t) && r.push(e);
          }
          r.length > 0 &&
            e.contentWindow.postMessage(
              {
                type: "update-elements",
                elements: r.map((e) => ({
                  id: e.id,
                  elType: e.type,
                  slotType: e.slotType,
                  currentValue: e.currentValue,
                  richHtml: e.richHtml,
                  deleted: e.deleted,
                  fontFamily: e.fontFamily,
                  fontSize: e.fontSize,
                  color: e.color,
                  textAlign: e.textAlign,
                  fontWeight: e.fontWeight,
                  lineHeight: e.lineHeight,
                  letterSpacing: e.letterSpacing,
                  marginTop: e.marginTop,
                  marginBottom: e.marginBottom,
                  marginLeft: e.marginLeft,
                  marginRight: e.marginRight,
                  borderRadius: e.borderRadius,
                  opacity: e.opacity,
                  objectFit: e.objectFit,
                  backgroundPosition: e.backgroundPosition,
                  backgroundSize: e.backgroundSize,
                  translateX: e.translateX,
                  translateY: e.translateY,
                  width: e.width,
                  height: e.height,
                  rotate: e.rotate,
                })),
              },
              "*",
            );
          let l = C(c);
          l !== C(t) && l && e.contentWindow.postMessage({ type: "update-font-css", css: l }, "*");
        }, [c, n]);
        let F = (0, r.useRef)(0);
        return (
          (0, r.useEffect)(() => {
            if (!y.current) return;
            let e = () => {
              let e = y.current;
              if (!e) return;
              let t = e.clientWidth || 300;
              if (1 > Math.abs(t - F.current)) return;
              F.current = t;
              let n = t / S.width;
              ((N.current = n),
                j.current && (j.current.style.transform = "scale(".concat(n, ")")),
                (e.style.height = "".concat(S.height * n, "px")));
            };
            ((F.current = 0), e());
            let t = new ResizeObserver(e);
            return (t.observe(y.current), () => t.disconnect());
          }, [S.width, S.height]),
          (0, r.useEffect)(() => {
            let e = (e) => {
              var t, n, a, r, l, i, s, o, c, d;
              (e.data && "element-click" === e.data.type && T.current.onElementClick(e.data.id),
                e.data &&
                  "element-text-update" === e.data.type &&
                  (null == (t = (n = T.current).onElementTextUpdate) || t.call(n, e.data.id, e.data.value)),
                e.data &&
                  "element-richtext-update" === e.data.type &&
                  (null == (a = (r = T.current).onElementRichtextUpdate) || a.call(r, e.data.id, e.data.value)),
                e.data &&
                  "element-move" === e.data.type &&
                  (null == (l = (i = T.current).onElementMove) ||
                    l.call(i, e.data.id, e.data.translateX, e.data.translateY)),
                e.data &&
                  "element-resize" === e.data.type &&
                  (null == (s = (o = T.current).onElementResize) || s.call(o, e.data.id, e.data.width, e.data.height)),
                e.data &&
                  "element-rotate" === e.data.type &&
                  (null == (c = (d = T.current).onElementRotate) || c.call(d, e.data.id, e.data.rotate)));
            };
            return (window.addEventListener("message", e), () => window.removeEventListener("message", e));
          }, []),
          (0, r.useEffect)(() => {
            var e, t;
            let a = w.current;
            if (!a || !A) return;
            let r = () => {
              try {
                let e = a.contentDocument;
                if (e) {
                  let t = e.querySelector('[data-editable-id][contenteditable="true"]');
                  if (t) {
                    let n = t.getAttribute("data-editable-id");
                    if (n) {
                      let a = t.cloneNode(!0);
                      (a.querySelectorAll("[data-editable-id]").forEach((e) => e.removeAttribute("data-editable-id")),
                        a.querySelectorAll("font").forEach((t) => {
                          var n;
                          let a = e.createElement("span");
                          (t.getAttribute("color") && (a.style.color = t.getAttribute("color") || ""),
                            t.getAttribute("size") &&
                              (a.style.fontSize =
                                { 1: "8px", 2: "10px", 3: "12px", 4: "14px", 5: "18px", 6: "24px", 7: "36px" }[
                                  t.getAttribute("size") || ""
                                ] || t.getAttribute("size") + "px"),
                            t.getAttribute("face") && (a.style.fontFamily = t.getAttribute("face") || ""),
                            (a.innerHTML = t.innerHTML),
                            null == (n = t.parentNode) || n.replaceChild(a, t));
                        }),
                        a.querySelectorAll("[style]").forEach((e) => {
                          var t;
                          (e.style.removeProperty("cursor"),
                            (e.getAttribute("style") &&
                              (null == (t = e.getAttribute("style")) ? void 0 : t.trim()) !== "") ||
                              e.removeAttribute("style"));
                        }));
                      let r = a.innerHTML;
                      /<(span|b|i|em|strong)\b/i.test(r)
                        ? null == g || g(n, r)
                        : null == u || u(n, t.textContent || "");
                    }
                  }
                  try {
                    (e.querySelectorAll("img").forEach((e) => {
                      (e.removeAttribute("src"), (e.srcset = ""));
                    }),
                      e.querySelectorAll('[style*="background-image"]').forEach((e) => {
                        e.style.backgroundImage = "none";
                      }));
                  } catch (e) {}
                  (e.open(), e.write(A), e.close(), (R.current = n), (z.current = c));
                }
              } catch (e) {
                ((a.srcdoc = A), (R.current = n), (z.current = c));
              }
            };
            (null == (e = a.contentDocument) ? void 0 : e.readyState) === "complete" ||
            (null == (t = a.contentDocument) ? void 0 : t.readyState) === "interactive"
              ? r()
              : (a.addEventListener("load", r, { once: !0 }),
                (a.srcdoc = "<!DOCTYPE html><html><head></head><body></body></html>"));
          }, [A]),
          (0, r.useEffect)(() => {
            var e;
            let t = i || o;
            (null == (e = w.current) ? void 0 : e.contentWindow) &&
              w.current.contentWindow.postMessage({ type: "highlight", id: t }, "*");
          }, [i, o]),
          (0, a.jsxs)("div", {
            ref: y,
            className: "relative w-full overflow-hidden bg-gray-100 rounded-lg",
            style: { height: S.height * N.current || "auto" },
            children: [
              (0, a.jsx)("div", {
                ref: j,
                className: "absolute top-0 left-0 origin-top-left",
                style: {
                  width: S.width,
                  height: S.height,
                  transform: "scale(".concat(N.current, ")"),
                  willChange: "transform",
                  backfaceVisibility: "hidden",
                },
                children: (0, a.jsx)("iframe", {
                  ref: w,
                  className: "w-full h-full border-0",
                  sandbox: "allow-same-origin allow-scripts",
                  title: "Preview",
                  style: { width: S.width, height: S.height },
                }),
              }),
              !i &&
                !o &&
                (0, a.jsxs)("div", {
                  className:
                    "absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 pointer-events-none",
                  children: [
                    E ? (0, a.jsx)(q.A, { className: "h-3 w-3" }) : (0, a.jsx)(_.A, { className: "h-3 w-3" }),
                    (0, a.jsx)("span", { children: v(E ? "pageEditor.tapToEdit" : "pageEditor.clickToEdit") }),
                  ],
                }),
              i &&
                (0, a.jsx)("div", {
                  className: "absolute inset-0 pointer-events-none",
                  children: (0, a.jsxs)("div", {
                    className: "absolute top-2 right-2 flex items-center gap-1.5",
                    children: [
                      (0, a.jsxs)("div", {
                        className:
                          "bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full flex items-center gap-1",
                        children: [
                          (0, a.jsx)(_.A, { className: "h-3 w-3" }),
                          (0, a.jsx)("span", {
                            children: v(
                              (null == (t = c.find((e) => e.id === i)) ? void 0 : t.type) === "text"
                                ? "pageEditor.editingText"
                                : "pageEditor.editingImage",
                            ),
                          }),
                        ],
                      }),
                      f &&
                        !x &&
                        (0, a.jsx)("button", {
                          type: "button",
                          className:
                            "pointer-events-auto bg-destructive text-destructive-foreground text-xs p-1.5 rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors shadow-sm",
                          onClick: () => f(i),
                          title: v("pageEditor.deleteElement"),
                          children: (0, a.jsx)(G.A, { className: "h-3 w-3" }),
                        }),
                    ],
                  }),
                }),
            ],
          })
        );
      }
      var Z = n(37388),
        ee = n(97032),
        et = n(69012);
      let en = { type: "spring", stiffness: 400, damping: 35 };
      function ea(e, t) {
        let n = window.innerHeight;
        switch (e) {
          case "collapsed":
            return t;
          case "mid":
            return 0.3 * n;
          case "expanded":
            return 0.7 * n;
        }
      }
      var er = n(45643),
        el = n(60501),
        ei = n(59722),
        es = n(94338),
        eo = n(43323),
        ec = n(89011),
        ed = n(38384),
        eu = n(74523),
        eg = n(11370),
        em = n(99062),
        ep = n(25790),
        eh = n(86392),
        ef = n(63108),
        ex = n(60839),
        eb = n(34314),
        ev = n(58458),
        ey = n(85602),
        ew = n(84128),
        ej = n(70399),
        eN = n(81358),
        eE = n(65570),
        ek = n(2212),
        eS = n(35835),
        eC = n(64066);
      let eA = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
      function eR(e) {
        let { assets: t, currentValue: n, elementId: l, isUploading: i, onSelect: c, onUpload: d, onDelete: g } = e,
          m = (0, s.useTranslations)("CarouselLab"),
          p = (0, r.useRef)(null),
          f = (0, r.useCallback)(
            async (e) => {
              let t = e.target.files;
              if (t && 0 !== t.length) {
                for (let e of Array.from(t)) eA.includes(e.type) && (await d(e));
                p.current && (p.current.value = "");
              }
            },
            [d],
          );
        return (0, a.jsxs)("div", {
          className: "space-y-2",
          children: [
            (0, a.jsx)("input", {
              ref: p,
              type: "file",
              accept: "image/png,image/jpeg,image/webp,image/svg+xml",
              multiple: !0,
              className: "hidden",
              onChange: f,
            }),
            t.length > 0
              ? (0, a.jsxs)("div", {
                  className: "space-y-1.5",
                  children: [
                    (0, a.jsxs)("div", {
                      className: "flex items-center justify-between",
                      children: [
                        (0, a.jsxs)("p", {
                          className: "text-xs text-muted-foreground",
                          children: [t.length, " ", 1 === t.length ? "image" : "images"],
                        }),
                        (0, a.jsxs)(u.$, {
                          variant: "ghost",
                          size: "sm",
                          className: "h-6 px-2 text-xs",
                          onClick: () => {
                            var e;
                            return null == (e = p.current) ? void 0 : e.click();
                          },
                          disabled: i,
                          children: [
                            i
                              ? (0, a.jsx)(ew.A, { className: "h-3 w-3 animate-spin" })
                              : (0, a.jsx)(eC.A, { className: "h-3 w-3 mr-1" }),
                            m("pageEditor.selectFiles"),
                          ],
                        }),
                      ],
                    }),
                    (0, a.jsx)(el.F, {
                      className: "max-h-[200px]",
                      children: (0, a.jsx)("div", {
                        className: "grid grid-cols-4 sm:grid-cols-5 gap-1.5 pr-2",
                        children: t.map((e) =>
                          (0, a.jsxs)(
                            "div",
                            {
                              className: "relative group",
                              children: [
                                (0, a.jsxs)("button", {
                                  type: "button",
                                  className: (0, o.cn)(
                                    "relative aspect-square rounded-md overflow-hidden border-2 transition-colors bg-muted/50 w-full",
                                    n === e.imageUrl
                                      ? "border-primary"
                                      : "border-transparent hover:border-muted-foreground/50",
                                  ),
                                  onClick: () => c(l, e.imageUrl),
                                  title: e.name,
                                  children: [
                                    (0, a.jsx)("img", {
                                      src: e.imageUrl,
                                      alt: e.name,
                                      className: "w-full h-full object-cover",
                                      loading: "lazy",
                                    }),
                                    n === e.imageUrl &&
                                      (0, a.jsx)("div", {
                                        className:
                                          "absolute top-0.5 right-0.5 bg-primary text-primary-foreground rounded-full p-0.5",
                                        children: (0, a.jsx)(h.A, { className: "h-2.5 w-2.5" }),
                                      }),
                                  ],
                                }),
                                (0, a.jsx)("button", {
                                  type: "button",
                                  className:
                                    "absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10",
                                  onClick: (t) => {
                                    (t.stopPropagation(), g(e.id));
                                  },
                                  children: (0, a.jsx)(ey.A, { className: "h-2.5 w-2.5" }),
                                }),
                              ],
                            },
                            e.id,
                          ),
                        ),
                      }),
                    }),
                  ],
                })
              : (0, a.jsxs)("div", {
                  className: "flex flex-col items-center gap-2 py-4 text-center",
                  children: [
                    (0, a.jsx)(ec.A, { className: "h-8 w-8 text-muted-foreground/40" }),
                    (0, a.jsx)("p", {
                      className: "text-xs text-muted-foreground",
                      children: m("pageEditor.noCustomAssets"),
                    }),
                    (0, a.jsxs)(u.$, {
                      variant: "outline",
                      size: "sm",
                      className: "text-xs",
                      onClick: () => {
                        var e;
                        return null == (e = p.current) ? void 0 : e.click();
                      },
                      disabled: i,
                      children: [
                        i
                          ? (0, a.jsx)(ew.A, { className: "h-3 w-3 animate-spin mr-1" })
                          : (0, a.jsx)(eC.A, { className: "h-3 w-3 mr-1" }),
                        m("pageEditor.selectFiles"),
                      ],
                    }),
                  ],
                }),
          ],
        });
      }
      var eT = n(65837),
        ez = n(57297),
        eH = n(58896),
        eF = n(29914),
        eM = n(57306);
      let eL = [
        { value: "1:1", icon: ez.A },
        { value: "4:5", icon: eH.A },
        { value: "3:4", icon: eH.A },
        { value: "16:9", icon: eF.A },
        { value: "9:16", icon: eH.A },
      ];
      function eP(e) {
        let {
            elementId: t,
            state: n,
            isProxyUploading: l,
            onSelectImage: i,
            onPromptChange: c,
            onRatioChange: d,
            onReferenceImageUrlChange: m,
            onReferenceUploadStateChange: p,
            onNumImagesChange: f,
            onGenerate: b,
          } = e,
          v = (0, s.useTranslations)("CarouselLab"),
          y = (0, r.useRef)(null),
          [w, j] = (0, r.useState)(!1),
          [N, E] = (0, r.useState)(!1),
          {
            prompt: k,
            selectedRatio: S,
            referenceImageUrl: C,
            isUploadingRef: A,
            numImages: R,
            generating: T,
            generatedImages: z,
          } = n,
          H = O.X7.CAROUSEL_AI_IMAGE * R,
          F = (0, r.useCallback)(
            async (e) => {
              if (e.type.startsWith("image/")) {
                p(!0);
                try {
                  let t = await U.E.uploadFile(e);
                  m(t);
                } catch (e) {
                  (0, x.toast)({ title: v("pageEditor.uploadFailed"), variant: "destructive" });
                } finally {
                  p(!1);
                }
              }
            },
            [m, p, v],
          ),
          M = (0, r.useCallback)(
            (e) => {
              var t;
              let n = null == (t = e.target.files) ? void 0 : t[0];
              (n && F(n), e.target && (e.target.value = ""));
            },
            [F],
          ),
          L = (0, r.useCallback)((e) => {
            (e.preventDefault(), j(!0));
          }, []),
          P = (0, r.useCallback)(() => {
            j(!1);
          }, []),
          I = (0, r.useCallback)(
            (e) => {
              var t;
              (e.preventDefault(), j(!1));
              let n = null == (t = e.dataTransfer.files) ? void 0 : t[0];
              n && F(n);
            },
            [F],
          ),
          D = (0, r.useCallback)(() => {
            k.trim() && E(!0);
          }, [k]),
          V = (0, r.useCallback)(async () => {
            (E(!1), await b());
          }, [b]);
        return (0, a.jsxs)("div", {
          className: "space-y-3",
          children: [
            (0, a.jsxs)("div", {
              className: "space-y-1.5",
              children: [
                (0, a.jsxs)("div", {
                  className: "flex items-center justify-between",
                  children: [
                    (0, a.jsx)(ef.J, {
                      className: "text-xs text-muted-foreground",
                      children: v("pageEditor.aiPrompt"),
                    }),
                    (0, a.jsx)("span", {
                      className: "text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded",
                      children: v("pageEditor.aiModelBadge"),
                    }),
                  ],
                }),
                (0, a.jsx)(eh.T, {
                  value: k,
                  onChange: (e) => c(e.target.value),
                  placeholder: v("pageEditor.aiPromptPlaceholder"),
                  className: "text-xs min-h-[72px] resize-none",
                  disabled: T,
                }),
              ],
            }),
            (0, a.jsxs)("div", {
              className: "flex items-end gap-3",
              children: [
                (0, a.jsxs)("div", {
                  className: "space-y-1.5 flex-1 min-w-0",
                  children: [
                    (0, a.jsx)(ef.J, {
                      className: "text-xs text-muted-foreground",
                      children: v("settings.aspectRatio"),
                    }),
                    (0, a.jsx)("div", {
                      className: "flex gap-1",
                      children: eL.map((e) => {
                        let { value: t, icon: n } = e;
                        return (0, a.jsxs)(
                          "button",
                          {
                            type: "button",
                            className: (0, o.cn)(
                              "flex items-center gap-1 px-2 py-1.5 rounded-md border text-xs transition-all",
                              S === t
                                ? "border-primary bg-primary/10 text-primary font-medium"
                                : "border-muted text-muted-foreground hover:border-muted-foreground/30",
                            ),
                            onClick: () => d(t),
                            disabled: T,
                            children: [(0, a.jsx)(n, { className: "h-3 w-3" }), t],
                          },
                          t,
                        );
                      }),
                    }),
                  ],
                }),
                (0, a.jsxs)("div", {
                  className: "space-y-1.5 shrink-0",
                  children: [
                    (0, a.jsx)(ef.J, {
                      className: "text-xs text-muted-foreground",
                      children: v("pageEditor.numImages"),
                    }),
                    (0, a.jsxs)("div", {
                      className: "flex items-center gap-1.5",
                      children: [
                        (0, a.jsx)("button", {
                          type: "button",
                          className:
                            "flex items-center justify-center h-7 w-7 rounded-md border border-muted hover:border-muted-foreground/30 transition-colors disabled:opacity-50",
                          onClick: () => f(Math.max(1, R - 1)),
                          disabled: T || R <= 1,
                          children: (0, a.jsx)(eM.A, { className: "h-3 w-3" }),
                        }),
                        (0, a.jsx)("span", {
                          className: "text-xs font-medium tabular-nums w-5 text-center",
                          children: R,
                        }),
                        (0, a.jsx)("button", {
                          type: "button",
                          className:
                            "flex items-center justify-center h-7 w-7 rounded-md border border-muted hover:border-muted-foreground/30 transition-colors disabled:opacity-50",
                          onClick: () => f(Math.min(4, R + 1)),
                          disabled: T || R >= 4,
                          children: (0, a.jsx)(eC.A, { className: "h-3 w-3" }),
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            (0, a.jsxs)("div", {
              className: "space-y-1.5",
              children: [
                (0, a.jsx)(ef.J, {
                  className: "text-xs text-muted-foreground",
                  children: v("pageEditor.referenceImage"),
                }),
                C
                  ? (0, a.jsxs)("div", {
                      className: "relative rounded-lg border overflow-hidden bg-muted/30",
                      children: [
                        (0, a.jsx)("img", { src: C, alt: "Reference", className: "w-full max-h-32 object-contain" }),
                        (0, a.jsx)("button", {
                          type: "button",
                          className:
                            "absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors",
                          onClick: () => m(null),
                          children: (0, a.jsx)(ey.A, { className: "h-3 w-3" }),
                        }),
                      ],
                    })
                  : (0, a.jsxs)("div", {
                      className: (0, o.cn)(
                        "flex flex-col items-center justify-center gap-1.5 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                        w
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/20 hover:border-muted-foreground/40",
                        A && "opacity-50 pointer-events-none",
                      ),
                      onDragOver: L,
                      onDragLeave: P,
                      onDrop: I,
                      onClick: () => {
                        var e;
                        return null == (e = y.current) ? void 0 : e.click();
                      },
                      children: [
                        A
                          ? (0, a.jsx)(ew.A, { className: "h-5 w-5 text-muted-foreground animate-spin" })
                          : (0, a.jsx)(ec.A, { className: "h-5 w-5 text-muted-foreground" }),
                        (0, a.jsx)("span", {
                          className: "text-[10px] text-muted-foreground text-center",
                          children: v("pageEditor.referenceImageHint"),
                        }),
                      ],
                    }),
                (0, a.jsx)("input", {
                  ref: y,
                  type: "file",
                  accept: "image/png,image/jpeg,image/webp",
                  className: "hidden",
                  onChange: M,
                }),
              ],
            }),
            (0, a.jsxs)(u.$, {
              className: "w-full",
              size: "sm",
              onClick: D,
              disabled: T || !k.trim(),
              children: [
                T
                  ? (0, a.jsx)(ew.A, { className: "h-3.5 w-3.5 animate-spin mr-1.5" })
                  : (0, a.jsx)(g.A, { className: "h-3.5 w-3.5 mr-1.5" }),
                T ? v("contentGen.generating") : v("pageEditor.generateImages", { cost: H }),
              ],
            }),
            z.length > 0 &&
              (0, a.jsxs)("div", {
                className: "space-y-1.5",
                children: [
                  (0, a.jsx)(ef.J, {
                    className: "text-xs text-muted-foreground",
                    children: v("pageEditor.aiGenerateResults"),
                  }),
                  (0, a.jsx)("div", {
                    className: "grid grid-cols-2 gap-1.5",
                    children: z.map((e, n) =>
                      (0, a.jsxs)(
                        "button",
                        {
                          type: "button",
                          className: (0, o.cn)(
                            "relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors group",
                            l === t && "opacity-50 cursor-wait",
                          ),
                          onClick: () => i(t, e.url),
                          disabled: l === t,
                          children: [
                            (0, a.jsx)("img", {
                              src: e.url,
                              alt: "AI generated ".concat(n + 1),
                              className: "w-full h-full object-cover",
                              loading: "lazy",
                            }),
                            (0, a.jsx)("div", {
                              className:
                                "absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center",
                              children:
                                l === t
                                  ? (0, a.jsx)(ew.A, { className: "h-5 w-5 text-white animate-spin" })
                                  : (0, a.jsx)(h.A, { className: "h-5 w-5 text-white" }),
                            }),
                          ],
                        },
                        n,
                      ),
                    ),
                  }),
                ],
              }),
            (0, a.jsx)(eT.Lt, {
              open: N,
              onOpenChange: E,
              children: (0, a.jsxs)(eT.EO, {
                zIndex: 10100,
                children: [
                  (0, a.jsxs)(eT.wd, {
                    children: [
                      (0, a.jsx)(eT.r7, { children: v("pageEditor.aiConfirmTitle") }),
                      (0, a.jsx)(eT.$v, { children: v("pageEditor.aiConfirmDesc", { cost: H }) }),
                    ],
                  }),
                  (0, a.jsxs)(eT.ck, {
                    children: [
                      (0, a.jsx)(eT.Zr, { children: v("cancel") }),
                      (0, a.jsx)(eT.Rx, { onClick: V, children: v("pageEditor.aiConfirmAction") }),
                    ],
                  }),
                ],
              }),
            }),
          ],
        });
      }
      var eI = n(52509),
        eD = n(95278),
        eU = n(46211),
        eO = n(9554),
        eV = n(87239),
        eW = n(17559);
      let eX = (0, r.memo)(function (e) {
        let {
            imageUrl: t,
            backgroundPosition: n,
            backgroundSize: l,
            onPositionChange: i,
            onSizeChange: s,
            onReset: c,
            t: d,
          } = e,
          g = (0, r.useRef)(null),
          [m, p] = (0, r.useState)(!1),
          [h, f] = (0, r.useState)(!1),
          x = (0, r.useMemo)(() => {
            var e;
            if (!n || "center" === n) return { x: 50, y: 50 };
            let t = n.replace(/%/g, "").split(/\s+/);
            return { x: parseFloat(t[0]) || 50, y: parseFloat(null != (e = t[1]) ? e : t[0]) || 50 };
          }, [n]),
          b = (0, r.useMemo)(() => {
            if (!l || "cover" === l || "contain" === l) return 100;
            let e = parseFloat(l);
            return isNaN(e) ? 100 : e;
          }, [l]),
          v = "cover" === l || "contain" === l,
          y = (0, r.useCallback)((e) => {
            if (!g.current) return null;
            let t = g.current.getBoundingClientRect();
            return {
              x: Math.max(0, Math.min(100, ((e.clientX - t.left) / t.width) * 100)),
              y: Math.max(0, Math.min(100, ((e.clientY - t.top) / t.height) * 100)),
            };
          }, []),
          w = (0, r.useCallback)(
            (e) => {
              (e.preventDefault(), f(!0), e.target.setPointerCapture(e.pointerId));
              let t = y(e);
              t && i("".concat(t.x.toFixed(1), "% ").concat(t.y.toFixed(1), "%"));
            },
            [y, i],
          ),
          j = (0, r.useCallback)(
            (e) => {
              if (!h) return;
              e.preventDefault();
              let t = y(e);
              t && i("".concat(t.x.toFixed(1), "% ").concat(t.y.toFixed(1), "%"));
            },
            [h, y, i],
          ),
          N = (0, r.useCallback)(() => {
            f(!1);
          }, []),
          E = (0, r.useCallback)(
            (e) => {
              let t = e[0];
              void 0 !== t && s("".concat(t, "%"));
            },
            [s],
          );
        return (0, a.jsxs)("div", {
          className: "space-y-3",
          children: [
            (0, a.jsxs)(ef.J, {
              className: "text-xs text-muted-foreground flex items-center gap-1.5",
              children: [(0, a.jsx)(eD.A, { className: "h-3.5 w-3.5" }), d("pageEditor.focalPoint")],
            }),
            (0, a.jsxs)("div", {
              ref: g,
              className: (0, o.cn)(
                "relative aspect-video rounded-lg overflow-hidden bg-muted border-2 transition-colors select-none",
                h ? "border-primary cursor-crosshair" : "border-muted-foreground/20 cursor-crosshair",
              ),
              onPointerDown: w,
              onPointerMove: j,
              onPointerUp: N,
              style: { touchAction: "none" },
              children: [
                (0, a.jsx)("img", {
                  src: t,
                  alt: "",
                  className: "w-full h-full object-cover pointer-events-none",
                  draggable: !1,
                  onLoad: () => p(!0),
                  onError: (e) => {
                    e.target.style.display = "none";
                  },
                }),
                !m &&
                  (0, a.jsx)("div", {
                    className: "absolute inset-0 flex items-center justify-center bg-muted animate-pulse",
                    children: (0, a.jsx)(ec.A, { className: "h-8 w-8 text-muted-foreground/40" }),
                  }),
                m &&
                  (0, a.jsxs)("div", {
                    className: "absolute inset-0 pointer-events-none",
                    children: [
                      (0, a.jsx)("div", {
                        className: "absolute top-0 bottom-0 w-px bg-white/60",
                        style: { left: "".concat(x.x, "%") },
                      }),
                      (0, a.jsx)("div", {
                        className: "absolute left-0 right-0 h-px bg-white/60",
                        style: { top: "".concat(x.y, "%") },
                      }),
                      (0, a.jsx)("div", {
                        className:
                          "absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/80 shadow-md",
                        style: { left: "".concat(x.x, "%"), top: "".concat(x.y, "%") },
                      }),
                    ],
                  }),
              ],
            }),
            (0, a.jsx)("p", {
              className: "text-xs text-muted-foreground italic",
              children: d("pageEditor.focalPointHint"),
            }),
            (0, a.jsxs)("div", {
              className: "space-y-1.5",
              children: [
                (0, a.jsxs)("div", {
                  className: "flex items-center justify-between",
                  children: [
                    (0, a.jsxs)(ef.J, {
                      className: "text-xs text-muted-foreground flex items-center gap-1.5",
                      children: [(0, a.jsx)(eU.A, { className: "h-3.5 w-3.5" }), d("pageEditor.zoomLevel")],
                    }),
                    (0, a.jsx)("span", {
                      className: "text-xs font-medium tabular-nums",
                      children: v ? l : "".concat(b, "%"),
                    }),
                  ],
                }),
                (0, a.jsx)(eI.A, { value: [b], onValueChange: E, min: 100, max: 300, step: 5, className: "w-full" }),
              ],
            }),
            (0, a.jsxs)("div", {
              className: "flex items-center gap-1",
              children: [
                (0, a.jsxs)(u.$, {
                  variant: "cover" === (l || "cover") ? "default" : "outline",
                  size: "sm",
                  className: "flex-1 h-8 text-xs gap-1.5",
                  onClick: () => s("cover"),
                  children: [(0, a.jsx)(eO.A, { className: "h-3.5 w-3.5" }), d("pageEditor.bgSizeFill")],
                }),
                (0, a.jsxs)(u.$, {
                  variant: "contain" === (l || "cover") ? "default" : "outline",
                  size: "sm",
                  className: "flex-1 h-8 text-xs gap-1.5",
                  onClick: () => s("contain"),
                  children: [(0, a.jsx)(eV.A, { className: "h-3.5 w-3.5" }), d("pageEditor.bgSizeShowAll")],
                }),
                (0, a.jsx)(u.$, {
                  variant: "ghost",
                  size: "sm",
                  className: "h-8 px-2",
                  onClick: c,
                  title: d("pageEditor.resetPosition"),
                  children: (0, a.jsx)(eW.A, { className: "h-3 w-3" }),
                }),
              ],
            }),
          ],
        });
      });
      function eY(e) {
        let { featureKey: t, t: n } = e,
          r = n("pageEditor.".concat(t));
        return (0, a.jsxs)("div", {
          className: "flex flex-col items-center gap-2 py-6 px-4 text-center",
          children: [
            (0, a.jsx)("div", {
              className: "w-10 h-10 rounded-full bg-muted flex items-center justify-center",
              children:
                "aiGenerate" === t
                  ? (0, a.jsx)(g.A, { className: "h-5 w-5 text-muted-foreground" })
                  : (0, a.jsx)(ec.A, { className: "h-5 w-5 text-muted-foreground" }),
            }),
            (0, a.jsx)("p", { className: "text-sm font-medium text-foreground", children: r }),
            (0, a.jsx)("p", {
              className: "text-xs text-muted-foreground",
              children: n("pageEditor.publicFeatureGateDesc"),
            }),
            (0, a.jsx)(u.$, {
              variant: "default",
              size: "sm",
              className: "mt-1",
              onClick: () => window.open("/signup", "_blank"),
              children: n("pageEditor.publicFeatureGateAction"),
            }),
          ],
        });
      }
      let eB = (0, r.memo)(function (e) {
        var t, n, l, i, s, c, d;
        let {
            element: g,
            isOpen: f,
            onToggle: x,
            onHover: b,
            isUploading: v,
            isRemovingBg: w,
            searchingImageId: j,
            searchResults: N,
            customSearchQuery: E,
            isProxyUploading: k,
            imageSource: S,
            onUpload: C,
            onRemoveBg: A,
            onSearch: R,
            onLoadMore: T,
            searchHasMore: z,
            loadingMoreImageId: H,
            onSearchQueryChange: F,
            onSelectSearchedImage: M,
            onClearSearchResults: L,
            onUpdateValue: P,
            onUpdateStyle: I,
            onImageSourceChange: D,
            workspaceLogos: U,
            onSelectLogo: O,
            onApplyLogoToAllPages: V,
            onApplyFontToAllPages: W,
            onDelete: q,
            onClearRichText: _,
            totalPages: G,
            workspaceAssets: J,
            onSelectAsset: K,
            onUploadAsset: Q,
            onDeleteAsset: Z,
            isUploadingAsset: ee,
            onOpenAdvancedEditor: et,
            aiImageGenerateState: en,
            onAiImagePromptChange: ea,
            onAiImageRatioChange: er,
            onAiImageReferenceImageUrlChange: el,
            onAiImageReferenceUploadStateChange: es,
            onAiImageNumImagesChange: eo,
            onAiImageGenerate: eg,
            sandboxMode: eC,
            publicMode: eA,
            hideHeader: eT,
            t: ez,
          } = e,
          eH = "image" === g.type || "image-slot" === g.type,
          eF = "image-slot" === g.type,
          eM = eF && "logo" === g.slotType,
          eL = "div" === g.type,
          eI = null != (c = null != (s = E[g.id]) ? s : g.searchQuery) ? c : "",
          [eD, eU] = (0, r.useState)(eI),
          eO = (0, r.useRef)({ elementId: g.id, resolvedSearchQuery: eI });
        (0, r.useEffect)(() => {
          let e = eO.current;
          (e.elementId !== g.id || e.resolvedSearchQuery !== eI) &&
            (eU(eI), (eO.current = { elementId: g.id, resolvedSearchQuery: eI }));
        }, [g.id, eI]);
        let eV = (0, r.useRef)(!1);
        (0, r.useEffect)(() => {
          if (f && !eV.current && eH && !eM) {
            var e, t;
            if (
              ("google" === S || "pexels" === S || "unsplash" === S || "pinterest" === S) &&
              !(null == (e = N[g.id]) ? void 0 : e.length)
            ) {
              let e = null != (t = E[g.id]) ? t : g.searchQuery;
              e && R(g.id, e);
            }
          }
          eV.current = f;
        }, [f, eH, eM, S, g.id, g.searchQuery, N, E, R]);
        let eW = () => {
          if (eL) return ez("pageEditor.designElement");
          if (eF) return g.slotLabel || ez("pageEditor.imageArea");
          if ("image" === g.type) return ez("pageEditor.image");
          let e = g.currentValue;
          return e.length > 30 ? e.substring(0, 30) + "..." : e;
        };
        if (eL) {
          let e = g.backgroundColor;
          return (0, a.jsxs)("div", {
            className:
              "w-full flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors",
            onMouseEnter: () => b(g.id),
            onMouseLeave: () => b(null),
            children: [
              e
                ? (0, a.jsx)("div", {
                    className: "flex-shrink-0 w-8 h-8 rounded-md border border-gray-300",
                    style: { backgroundColor: e },
                    title: e,
                  })
                : (0, a.jsx)("div", {
                    className:
                      "flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center bg-orange-100 text-orange-600",
                    children: (0, a.jsx)(m.A, { className: "h-4 w-4" }),
                  }),
              (0, a.jsxs)("div", {
                className: "flex-1 min-w-0",
                children: [
                  (0, a.jsx)("span", { className: "text-sm font-medium truncate", children: eW() }),
                  e && (0, a.jsx)("span", { className: "text-xs text-muted-foreground ml-2", children: e }),
                ],
              }),
              (0, a.jsx)(u.$, {
                variant: "ghost",
                size: "sm",
                className: "text-destructive hover:text-destructive hover:bg-destructive/10",
                onClick: () => (null == q ? void 0 : q(g.id)),
                children: (0, a.jsx)(ey.A, { className: "h-4 w-4" }),
              }),
            ],
          });
        }
        return (0, a.jsxs)(eb.Nt, {
          open: !!eT || f,
          onOpenChange: eT ? void 0 : x,
          onMouseEnter: () => b(g.id),
          onMouseLeave: () => b(null),
          children: [
            !eT &&
              (0, a.jsx)(eb.R6, {
                asChild: !0,
                children: (0, a.jsxs)("button", {
                  type: "button",
                  className:
                    "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors hover:bg-muted/50 "
                      .concat(f ? "bg-muted border-primary" : "bg-background", " ")
                      .concat(eF && !g.currentValue ? "border-dashed border-amber-400" : ""),
                  children: [
                    (0, a.jsx)("div", {
                      className: "flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center ".concat(
                        eH ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600",
                      ),
                      children: eH
                        ? (0, a.jsx)(ec.A, { className: "h-4 w-4" })
                        : (0, a.jsx)(ei.A, { className: "h-4 w-4" }),
                    }),
                    (0, a.jsxs)("div", {
                      className: "flex-1 min-w-0",
                      children: [
                        (0, a.jsxs)("div", {
                          className: "flex items-center gap-2",
                          children: [
                            (0, a.jsx)("span", { className: "text-sm font-medium truncate", children: eW() }),
                            eF &&
                              !g.currentValue &&
                              (0, a.jsx)(ex.E, {
                                variant: "outline",
                                className: "text-xs bg-amber-50 text-amber-600 border-amber-300",
                                children: ez("pageEditor.needsImage"),
                              }),
                          ],
                        }),
                        eF &&
                          g.slotType &&
                          (0, a.jsx)(ex.E, {
                            variant: "outline",
                            className: (0, o.cn)(
                              "text-xs",
                              "logo" === g.slotType
                                ? "bg-purple-50 text-purple-600 border-purple-300"
                                : "bg-muted text-muted-foreground",
                            ),
                            children: g.slotType,
                          }),
                      ],
                    }),
                    (0, a.jsx)(ed.A, {
                      className: "h-4 w-4 text-muted-foreground transition-transform ".concat(f ? "rotate-180" : ""),
                    }),
                    (0, a.jsx)("div", {
                      role: "button",
                      tabIndex: 0,
                      className:
                        "p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors",
                      onClick: (e) => {
                        (e.stopPropagation(), null == q || q(g.id));
                      },
                      onKeyDown: (e) => {
                        ("Enter" === e.key || " " === e.key) && (e.stopPropagation(), null == q || q(g.id));
                      },
                      children: (0, a.jsx)(ey.A, { className: "h-4 w-4" }),
                    }),
                  ],
                }),
              }),
            (0, a.jsx)(eb.Ke, {
              children: (0, a.jsx)("div", {
                className: (0, o.cn)("space-y-3", eT ? "" : "pt-3 pb-1 px-1"),
                children: eH
                  ? (0, a.jsxs)(a.Fragment, {
                      children: [
                        eF && g.currentValue
                          ? (0, a.jsx)(eX, {
                              imageUrl: g.currentValue,
                              backgroundPosition: g.backgroundPosition || "center",
                              backgroundSize: g.backgroundSize || "cover",
                              onPositionChange: (e) => I(g.id, "backgroundPosition", e),
                              onSizeChange: (e) => I(g.id, "backgroundSize", e),
                              onReset: () => {
                                (I(g.id, "backgroundPosition", "center"), I(g.id, "backgroundSize", "cover"));
                              },
                              t: ez,
                            })
                          : (0, a.jsx)("div", {
                              className: "aspect-video bg-muted rounded-lg overflow-hidden",
                              children: g.currentValue
                                ? (0, a.jsx)("img", {
                                    src: g.currentValue,
                                    alt: "",
                                    className: "w-full h-full object-contain",
                                    onError: (e) => {
                                      e.target.style.display = "none";
                                    },
                                  })
                                : (0, a.jsx)("div", {
                                    className:
                                      "w-full h-full flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300",
                                    children: (0, a.jsxs)("div", {
                                      className: "text-center text-gray-400",
                                      children: [
                                        (0, a.jsx)(ec.A, { className: "h-8 w-8 mx-auto mb-2" }),
                                        (0, a.jsx)("p", {
                                          className: "text-xs",
                                          children: ez("pageEditor.uploadHint"),
                                        }),
                                        g.searchQuery &&
                                          (0, a.jsxs)("p", {
                                            className: "text-xs mt-1 text-amber-600",
                                            children: [ez("pageEditor.suggestedQuery"), ": ", g.searchQuery],
                                          }),
                                      ],
                                    }),
                                  }),
                            }),
                        eM &&
                          !eC &&
                          (0, a.jsxs)("div", {
                            className: "space-y-2",
                            children: [
                              (0, a.jsx)(ef.J, {
                                className: "text-xs text-muted-foreground",
                                children: ez("pageEditor.savedLogos"),
                              }),
                              U.length > 0
                                ? (0, a.jsx)("div", {
                                    className: "grid grid-cols-3 sm:grid-cols-4 gap-2",
                                    children: U.map((e) =>
                                      (0, a.jsxs)(
                                        "button",
                                        {
                                          type: "button",
                                          className: (0, o.cn)(
                                            "relative aspect-video rounded-md overflow-hidden border-2 transition-colors bg-muted/50 p-1",
                                            g.currentValue === e.imageUrl
                                              ? "border-primary"
                                              : "border-transparent hover:border-muted-foreground/50",
                                          ),
                                          onClick: () => O(g.id, e.imageUrl),
                                          title: e.name,
                                          children: [
                                            (0, a.jsx)("img", {
                                              src: e.imageUrl,
                                              alt: e.name,
                                              className: "w-full h-full object-contain",
                                              loading: "lazy",
                                            }),
                                            g.currentValue === e.imageUrl &&
                                              (0, a.jsx)("div", {
                                                className:
                                                  "absolute top-0.5 right-0.5 bg-primary text-primary-foreground rounded-full p-0.5",
                                                children: (0, a.jsx)(h.A, { className: "h-2.5 w-2.5" }),
                                              }),
                                          ],
                                        },
                                        e.id,
                                      ),
                                    ),
                                  })
                                : (0, a.jsxs)("div", {
                                    className: "text-xs text-muted-foreground bg-muted/30 rounded-md p-3 text-center",
                                    children: [
                                      (0, a.jsx)("p", { children: ez("pageEditor.noSavedLogos") }),
                                      (0, a.jsx)("p", {
                                        className: "mt-1 opacity-70",
                                        children: ez("pageEditor.addLogosHint"),
                                      }),
                                    ],
                                  }),
                              g.currentValue &&
                                G > 1 &&
                                (0, a.jsxs)(u.$, {
                                  variant: "outline",
                                  size: "sm",
                                  className: "w-full mt-2",
                                  onClick: () => V(g.currentValue),
                                  children: [
                                    (0, a.jsx)(eu.A, { className: "h-3 w-3 mr-1" }),
                                    ez("pageEditor.applyLogoToAllPages"),
                                  ],
                                }),
                            ],
                          }),
                        (0, a.jsxs)(u.$, {
                          variant: "outline",
                          size: "sm",
                          className: "w-full",
                          onClick: () => C(g.id),
                          disabled: v === g.id,
                          children: [
                            v === g.id
                              ? (0, a.jsx)(ew.A, { className: "h-3 w-3 animate-spin mr-1" })
                              : (0, a.jsx)(ej.A, { className: "h-3 w-3 mr-1" }),
                            eF && !g.currentValue ? ez("pageEditor.upload") : ez("pageEditor.replace"),
                          ],
                        }),
                        !eC &&
                          ((eF && !eM) || "image" === g.type || g.searchQuery) &&
                          (0, a.jsxs)(em.Tabs, {
                            value: S,
                            onValueChange: (e) => {
                              if ((D(e), "google" === e || "pexels" === e || "unsplash" === e || "pinterest" === e)) {
                                L(g.id);
                                let t = eD || g.searchQuery;
                                t && R(g.id, t, e);
                              }
                            },
                            className: "w-full",
                            children: [
                              (0, a.jsxs)(em.TabsList, {
                                className: "w-full h-8",
                                children: [
                                  (0, a.jsx)(em.TabsTrigger, {
                                    value: "google",
                                    className: "text-xs flex-1",
                                    children: ez("pageEditor.google"),
                                  }),
                                  (0, a.jsx)(em.TabsTrigger, {
                                    value: "pinterest",
                                    className: "text-xs flex-1",
                                    children: ez("pageEditor.pinterest"),
                                  }),
                                  (0, a.jsx)(em.TabsTrigger, {
                                    value: "pexels",
                                    className: "text-xs flex-1",
                                    children: ez("pageEditor.pexels"),
                                  }),
                                  (0, a.jsx)(em.TabsTrigger, {
                                    value: "ai",
                                    className: "text-xs flex-1",
                                    children: ez("pageEditor.aiGenerate"),
                                  }),
                                  (0, a.jsx)(em.TabsTrigger, {
                                    value: "custom",
                                    className: "text-xs flex-1",
                                    children: ez("pageEditor.customAssets"),
                                  }),
                                ],
                              }),
                              (0, a.jsx)(em.TabsContent, {
                                value: "custom",
                                className: "mt-2",
                                children: eA
                                  ? (0, a.jsx)(eY, { featureKey: "customAssets", t: ez })
                                  : (0, a.jsx)(eR, {
                                      assets: J,
                                      currentValue: g.currentValue,
                                      elementId: g.id,
                                      isUploading: ee,
                                      onSelect: K,
                                      onUpload: Q,
                                      onDelete: Z,
                                    }),
                              }),
                              (0, a.jsxs)(em.TabsContent, {
                                value: "google",
                                className: "mt-2 space-y-2",
                                children: [
                                  (0, a.jsxs)("p", {
                                    className: "text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1",
                                    children: [
                                      (0, a.jsx)(p.A, { className: "h-3 w-3 shrink-0" }),
                                      ez("pageEditor.googleCopyrightNotice"),
                                    ],
                                  }),
                                  (0, a.jsxs)("div", {
                                    className: "flex gap-2",
                                    children: [
                                      (0, a.jsx)(ep.p, {
                                        value: eD,
                                        onChange: (e) => eU(e.target.value),
                                        placeholder: ez("pageEditor.searchPlaceholder"),
                                        className: "text-xs",
                                      }),
                                      (0, a.jsx)(u.$, {
                                        variant: "secondary",
                                        size: "sm",
                                        onClick: () => {
                                          (F(g.id, eD), R(g.id, eD));
                                        },
                                        disabled: j === g.id,
                                        children:
                                          j === g.id
                                            ? (0, a.jsx)(ew.A, { className: "h-3 w-3 animate-spin" })
                                            : (0, a.jsx)(eN.A, { className: "h-3 w-3" }),
                                      }),
                                    ],
                                  }),
                                  (null == (t = N[g.id]) ? void 0 : t.length) > 0 &&
                                    (0, a.jsxs)("div", {
                                      className: "space-y-2",
                                      children: [
                                        (0, a.jsxs)("div", {
                                          className: "flex items-center justify-between",
                                          children: [
                                            (0, a.jsx)(ef.J, {
                                              className: "text-xs text-muted-foreground",
                                              children: ez("pageEditor.searchResults", { count: N[g.id].length }),
                                            }),
                                            (0, a.jsx)(u.$, {
                                              variant: "ghost",
                                              size: "sm",
                                              className: "h-6 px-2",
                                              onClick: () => L(g.id),
                                              children: (0, a.jsx)(ey.A, { className: "h-3 w-3" }),
                                            }),
                                          ],
                                        }),
                                        (0, a.jsx)("div", {
                                          className: "grid grid-cols-4 sm:grid-cols-5 gap-1 sm:gap-1.5",
                                          children: N[g.id].map((e, t) =>
                                            (0, a.jsxs)(
                                              "button",
                                              {
                                                type: "button",
                                                className:
                                                  "relative aspect-square rounded overflow-hidden border-2 border-transparent hover:border-primary transition-colors group ".concat(
                                                    k === g.id ? "opacity-50 cursor-wait" : "",
                                                  ),
                                                onClick: () => M(g.id, e.imageUrl, e.thumbnailUrl),
                                                disabled: k === g.id,
                                                children: [
                                                  (0, a.jsx)("img", {
                                                    src: e.thumbnailUrl || e.imageUrl,
                                                    alt: e.title,
                                                    className: "w-full h-full object-cover",
                                                    loading: "lazy",
                                                  }),
                                                  (0, a.jsx)("div", {
                                                    className:
                                                      "absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center",
                                                    children:
                                                      k === g.id
                                                        ? (0, a.jsx)(ew.A, {
                                                            className: "h-4 w-4 text-white animate-spin",
                                                          })
                                                        : (0, a.jsx)(h.A, { className: "h-4 w-4 text-white" }),
                                                  }),
                                                ],
                                              },
                                              t,
                                            ),
                                          ),
                                        }),
                                        z[g.id] &&
                                          (0, a.jsxs)(u.$, {
                                            variant: "outline",
                                            size: "sm",
                                            className: "w-full text-xs",
                                            onClick: () => T(g.id),
                                            disabled: H === g.id,
                                            children: [
                                              H === g.id
                                                ? (0, a.jsx)(ew.A, { className: "h-3 w-3 animate-spin mr-1" })
                                                : null,
                                              ez("pageEditor.loadMore"),
                                            ],
                                          }),
                                      ],
                                    }),
                                ],
                              }),
                              (0, a.jsxs)(em.TabsContent, {
                                value: "unsplash",
                                className: "mt-2 space-y-2",
                                children: [
                                  (0, a.jsxs)("div", {
                                    className: "flex gap-2",
                                    children: [
                                      (0, a.jsx)(ep.p, {
                                        value: eD,
                                        onChange: (e) => eU(e.target.value),
                                        placeholder: ez("pageEditor.searchPlaceholder"),
                                        className: "text-xs",
                                      }),
                                      (0, a.jsx)(u.$, {
                                        variant: "secondary",
                                        size: "sm",
                                        onClick: () => {
                                          (F(g.id, eD), R(g.id, eD));
                                        },
                                        disabled: j === g.id,
                                        children:
                                          j === g.id
                                            ? (0, a.jsx)(ew.A, { className: "h-3 w-3 animate-spin" })
                                            : (0, a.jsx)(eN.A, { className: "h-3 w-3" }),
                                      }),
                                    ],
                                  }),
                                  (null == (n = N[g.id]) ? void 0 : n.length) > 0 &&
                                    (0, a.jsxs)("div", {
                                      className: "space-y-2",
                                      children: [
                                        (0, a.jsxs)("div", {
                                          className: "flex items-center justify-between",
                                          children: [
                                            (0, a.jsx)(ef.J, {
                                              className: "text-xs text-muted-foreground",
                                              children: ez("pageEditor.searchResults", { count: N[g.id].length }),
                                            }),
                                            (0, a.jsx)(u.$, {
                                              variant: "ghost",
                                              size: "sm",
                                              className: "h-6 px-2",
                                              onClick: () => L(g.id),
                                              children: (0, a.jsx)(ey.A, { className: "h-3 w-3" }),
                                            }),
                                          ],
                                        }),
                                        (0, a.jsx)("div", {
                                          className: "grid grid-cols-5 gap-1.5",
                                          children: N[g.id].map((e, t) =>
                                            (0, a.jsx)(
                                              "button",
                                              {
                                                type: "button",
                                                onClick: () => M(g.id, e.imageUrl, e.thumbnailUrl),
                                                className:
                                                  "relative aspect-square rounded overflow-hidden hover:ring-2 ring-primary transition-all group",
                                                children: (0, a.jsx)("img", {
                                                  src: e.thumbnailUrl || e.imageUrl,
                                                  alt: e.title,
                                                  className: "w-full h-full object-cover",
                                                  loading: "lazy",
                                                }),
                                              },
                                              t,
                                            ),
                                          ),
                                        }),
                                        z[g.id] &&
                                          (0, a.jsxs)(u.$, {
                                            variant: "outline",
                                            size: "sm",
                                            className: "w-full text-xs",
                                            onClick: () => T(g.id),
                                            disabled: H === g.id,
                                            children: [
                                              H === g.id
                                                ? (0, a.jsx)(ew.A, { className: "h-3 w-3 animate-spin mr-1" })
                                                : null,
                                              ez("pageEditor.loadMore"),
                                            ],
                                          }),
                                      ],
                                    }),
                                ],
                              }),
                              (0, a.jsxs)(em.TabsContent, {
                                value: "pexels",
                                className: "mt-2 space-y-2",
                                children: [
                                  (0, a.jsxs)("div", {
                                    className: "flex gap-2",
                                    children: [
                                      (0, a.jsx)(ep.p, {
                                        value: eD,
                                        onChange: (e) => eU(e.target.value),
                                        placeholder: ez("pageEditor.searchPlaceholder"),
                                        className: "text-xs",
                                      }),
                                      (0, a.jsx)(u.$, {
                                        variant: "secondary",
                                        size: "sm",
                                        onClick: () => {
                                          (F(g.id, eD), R(g.id, eD));
                                        },
                                        disabled: j === g.id,
                                        children:
                                          j === g.id
                                            ? (0, a.jsx)(ew.A, { className: "h-3 w-3 animate-spin" })
                                            : (0, a.jsx)(eN.A, { className: "h-3 w-3" }),
                                      }),
                                    ],
                                  }),
                                  (null == (l = N[g.id]) ? void 0 : l.length) > 0 &&
                                    (0, a.jsxs)("div", {
                                      className: "space-y-2",
                                      children: [
                                        (0, a.jsxs)("div", {
                                          className: "flex items-center justify-between",
                                          children: [
                                            (0, a.jsx)(ef.J, {
                                              className: "text-xs text-muted-foreground",
                                              children: ez("pageEditor.searchResults", { count: N[g.id].length }),
                                            }),
                                            (0, a.jsx)(u.$, {
                                              variant: "ghost",
                                              size: "sm",
                                              className: "h-6 px-2",
                                              onClick: () => L(g.id),
                                              children: (0, a.jsx)(ey.A, { className: "h-3 w-3" }),
                                            }),
                                          ],
                                        }),
                                        (0, a.jsx)("div", {
                                          className: "grid grid-cols-4 sm:grid-cols-5 gap-1 sm:gap-1.5",
                                          children: N[g.id].map((e, t) =>
                                            (0, a.jsxs)(
                                              "button",
                                              {
                                                type: "button",
                                                className:
                                                  "relative aspect-square rounded overflow-hidden border-2 border-transparent hover:border-primary transition-colors group ".concat(
                                                    k === g.id ? "opacity-50 cursor-wait" : "",
                                                  ),
                                                onClick: () => M(g.id, e.imageUrl, e.thumbnailUrl),
                                                disabled: k === g.id,
                                                children: [
                                                  (0, a.jsx)("img", {
                                                    src: e.thumbnailUrl || e.imageUrl,
                                                    alt: e.title,
                                                    className: "w-full h-full object-cover",
                                                    loading: "lazy",
                                                  }),
                                                  (0, a.jsx)("div", {
                                                    className:
                                                      "absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center",
                                                    children:
                                                      k === g.id
                                                        ? (0, a.jsx)(ew.A, {
                                                            className: "h-4 w-4 text-white animate-spin",
                                                          })
                                                        : (0, a.jsx)(h.A, { className: "h-4 w-4 text-white" }),
                                                  }),
                                                ],
                                              },
                                              t,
                                            ),
                                          ),
                                        }),
                                        z[g.id] &&
                                          (0, a.jsxs)(u.$, {
                                            variant: "outline",
                                            size: "sm",
                                            className: "w-full text-xs",
                                            onClick: () => T(g.id),
                                            disabled: H === g.id,
                                            children: [
                                              H === g.id
                                                ? (0, a.jsx)(ew.A, { className: "h-3 w-3 animate-spin mr-1" })
                                                : null,
                                              ez("pageEditor.loadMore"),
                                            ],
                                          }),
                                      ],
                                    }),
                                ],
                              }),
                              (0, a.jsxs)(em.TabsContent, {
                                value: "pinterest",
                                className: "mt-2 space-y-2",
                                children: [
                                  (0, a.jsxs)("p", {
                                    className: "text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1",
                                    children: [
                                      (0, a.jsx)(p.A, { className: "h-3 w-3 shrink-0" }),
                                      ez("pageEditor.pinterestCopyrightNotice"),
                                    ],
                                  }),
                                  (0, a.jsxs)("div", {
                                    className: "flex gap-2",
                                    children: [
                                      (0, a.jsx)(ep.p, {
                                        value: eD,
                                        onChange: (e) => eU(e.target.value),
                                        placeholder: ez("pageEditor.searchPlaceholder"),
                                        className: "text-xs",
                                      }),
                                      (0, a.jsx)(u.$, {
                                        variant: "secondary",
                                        size: "sm",
                                        onClick: () => {
                                          (F(g.id, eD), R(g.id, eD));
                                        },
                                        disabled: j === g.id,
                                        children:
                                          j === g.id
                                            ? (0, a.jsx)(ew.A, { className: "h-3 w-3 animate-spin" })
                                            : (0, a.jsx)(eN.A, { className: "h-3 w-3" }),
                                      }),
                                    ],
                                  }),
                                  (null == (i = N[g.id]) ? void 0 : i.length) > 0 &&
                                    (0, a.jsxs)("div", {
                                      className: "space-y-2",
                                      children: [
                                        (0, a.jsxs)("div", {
                                          className: "flex items-center justify-between",
                                          children: [
                                            (0, a.jsx)(ef.J, {
                                              className: "text-xs text-muted-foreground",
                                              children: ez("pageEditor.searchResults", { count: N[g.id].length }),
                                            }),
                                            (0, a.jsx)(u.$, {
                                              variant: "ghost",
                                              size: "sm",
                                              className: "h-6 px-2",
                                              onClick: () => L(g.id),
                                              children: (0, a.jsx)(ey.A, { className: "h-3 w-3" }),
                                            }),
                                          ],
                                        }),
                                        (0, a.jsx)("div", {
                                          className: "grid grid-cols-4 sm:grid-cols-5 gap-1 sm:gap-1.5",
                                          children: N[g.id].map((e, t) =>
                                            (0, a.jsxs)(
                                              "button",
                                              {
                                                type: "button",
                                                className:
                                                  "relative aspect-square rounded overflow-hidden border-2 border-transparent hover:border-primary transition-colors group ".concat(
                                                    k === g.id ? "opacity-50 cursor-wait" : "",
                                                  ),
                                                onClick: () => M(g.id, e.imageUrl, e.thumbnailUrl),
                                                disabled: k === g.id,
                                                children: [
                                                  (0, a.jsx)("img", {
                                                    src: e.thumbnailUrl || e.imageUrl,
                                                    alt: e.title,
                                                    className: "w-full h-full object-cover",
                                                    loading: "lazy",
                                                  }),
                                                  (0, a.jsx)("div", {
                                                    className:
                                                      "absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center",
                                                    children:
                                                      k === g.id
                                                        ? (0, a.jsx)(ew.A, {
                                                            className: "h-4 w-4 text-white animate-spin",
                                                          })
                                                        : (0, a.jsx)(h.A, { className: "h-4 w-4 text-white" }),
                                                  }),
                                                ],
                                              },
                                              t,
                                            ),
                                          ),
                                        }),
                                        z[g.id] &&
                                          (0, a.jsxs)(u.$, {
                                            variant: "outline",
                                            size: "sm",
                                            className: "w-full text-xs",
                                            onClick: () => T(g.id),
                                            disabled: H === g.id,
                                            children: [
                                              H === g.id
                                                ? (0, a.jsx)(ew.A, { className: "h-3 w-3 animate-spin mr-1" })
                                                : null,
                                              ez("pageEditor.loadMore"),
                                            ],
                                          }),
                                      ],
                                    }),
                                ],
                              }),
                              (0, a.jsx)(em.TabsContent, {
                                value: "ai",
                                className: "mt-2 data-[state=inactive]:hidden",
                                forceMount: !0,
                                children: eA
                                  ? (0, a.jsx)(eY, { featureKey: "aiGenerate", t: ez })
                                  : (0, a.jsx)(eP, {
                                      elementId: g.id,
                                      state: en,
                                      isProxyUploading: k,
                                      onSelectImage: M,
                                      onPromptChange: (e) => ea(g.id, e),
                                      onRatioChange: (e) => er(g.id, e),
                                      onReferenceImageUrlChange: (e) => el(g.id, e),
                                      onReferenceUploadStateChange: (e) => es(g.id, e),
                                      onNumImagesChange: (e) => eo(g.id, e),
                                      onGenerate: () => eg(g.id),
                                    }),
                              }),
                            ],
                          }),
                        !eC &&
                          g.currentValue &&
                          (0, a.jsxs)(u.$, {
                            variant: "outline",
                            size: "sm",
                            className: "w-full",
                            onClick: () => A(g.id, g.currentValue),
                            disabled: w === g.id,
                            children: [
                              w === g.id
                                ? (0, a.jsx)(ew.A, { className: "h-3 w-3 animate-spin mr-1" })
                                : (0, a.jsx)(eE.A, { className: "h-3 w-3 mr-1" }),
                              ez("pageEditor.removeBg"),
                            ],
                          }),
                        eH &&
                          g.currentValue &&
                          (0, a.jsxs)(eb.Nt, {
                            children: [
                              (0, a.jsx)(eb.R6, {
                                asChild: !0,
                                children: (0, a.jsxs)("button", {
                                  type: "button",
                                  className:
                                    "w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors",
                                  children: [
                                    (0, a.jsx)(ed.A, { className: "h-3 w-3" }),
                                    (0, a.jsx)("span", { children: ez("pageEditor.advancedStyles") }),
                                  ],
                                }),
                              }),
                              (0, a.jsx)(eb.Ke, {
                                children: (0, a.jsxs)("div", {
                                  className: "pt-2 border-t space-y-2",
                                  children: [
                                    (0, a.jsxs)("div", {
                                      className: (0, o.cn)("grid gap-2", eF ? "grid-cols-2" : "grid-cols-3"),
                                      children: [
                                        (0, a.jsxs)("div", {
                                          className: "space-y-1",
                                          children: [
                                            (0, a.jsx)(ef.J, {
                                              className: "text-xs text-muted-foreground",
                                              children: ez("pageEditor.borderRadius"),
                                            }),
                                            (0, a.jsxs)(ev.l6, {
                                              value: g.borderRadius || "inherit",
                                              onValueChange: (e) => I(g.id, "borderRadius", e),
                                              children: [
                                                (0, a.jsx)(ev.bq, {
                                                  className: "h-8 text-xs",
                                                  children: (0, a.jsx)(ev.yv, {}),
                                                }),
                                                (0, a.jsx)(ev.gC, {
                                                  children: X.map((e) =>
                                                    (0, a.jsx)(
                                                      ev.eb,
                                                      { value: e.value, className: "text-xs", children: e.label },
                                                      e.value,
                                                    ),
                                                  ),
                                                }),
                                              ],
                                            }),
                                          ],
                                        }),
                                        (0, a.jsxs)("div", {
                                          className: "space-y-1",
                                          children: [
                                            (0, a.jsx)(ef.J, {
                                              className: "text-xs text-muted-foreground",
                                              children: ez("pageEditor.opacity"),
                                            }),
                                            (0, a.jsxs)(ev.l6, {
                                              value: g.opacity || "inherit",
                                              onValueChange: (e) => I(g.id, "opacity", e),
                                              children: [
                                                (0, a.jsx)(ev.bq, {
                                                  className: "h-8 text-xs",
                                                  children: (0, a.jsx)(ev.yv, {}),
                                                }),
                                                (0, a.jsx)(ev.gC, {
                                                  children: Y.map((e) =>
                                                    (0, a.jsx)(
                                                      ev.eb,
                                                      { value: e.value, className: "text-xs", children: e.label },
                                                      e.value,
                                                    ),
                                                  ),
                                                }),
                                              ],
                                            }),
                                          ],
                                        }),
                                        !eF &&
                                          (0, a.jsxs)("div", {
                                            className: "space-y-1",
                                            children: [
                                              (0, a.jsx)(ef.J, {
                                                className: "text-xs text-muted-foreground",
                                                children: ez("pageEditor.objectFit"),
                                              }),
                                              (0, a.jsxs)(ev.l6, {
                                                value: g.objectFit || "inherit",
                                                onValueChange: (e) => I(g.id, "objectFit", e),
                                                children: [
                                                  (0, a.jsx)(ev.bq, {
                                                    className: "h-8 text-xs",
                                                    children: (0, a.jsx)(ev.yv, {}),
                                                  }),
                                                  (0, a.jsx)(ev.gC, {
                                                    children: B.map((e) =>
                                                      (0, a.jsx)(
                                                        ev.eb,
                                                        { value: e.value, className: "text-xs", children: e.label },
                                                        e.value,
                                                      ),
                                                    ),
                                                  }),
                                                ],
                                              }),
                                            ],
                                          }),
                                      ],
                                    }),
                                    g.currentValue &&
                                      (0, a.jsxs)(u.$, {
                                        variant: "ghost",
                                        size: "sm",
                                        className: "w-full text-xs",
                                        onClick: () => et(g.id),
                                        children: [
                                          (0, a.jsx)(ek.A, { className: "h-3 w-3 mr-1" }),
                                          ez("pageEditor.editImageAdvanced"),
                                        ],
                                      }),
                                  ],
                                }),
                              }),
                            ],
                          }),
                      ],
                    })
                  : (0, a.jsxs)(a.Fragment, {
                      children: [
                        g.richHtml
                          ? (0, a.jsxs)("div", {
                              className: "space-y-2",
                              children: [
                                (0, a.jsx)("div", {
                                  className: "text-sm min-h-[80px] p-3 rounded-md border bg-muted/30",
                                  dangerouslySetInnerHTML: { __html: g.currentValue },
                                }),
                                (0, a.jsx)("p", {
                                  className: "text-[11px] text-muted-foreground",
                                  children: ez("pageEditor.richTextHint"),
                                }),
                                (0, a.jsx)(u.$, {
                                  variant: "ghost",
                                  size: "sm",
                                  className: "text-xs",
                                  onClick: () => {
                                    let e = document.createElement("div");
                                    e.innerHTML = g.currentValue;
                                    let t = e.textContent || "";
                                    null == _ || _(g.id, t);
                                  },
                                  children: ez("pageEditor.clearFormatting"),
                                }),
                              ],
                            })
                          : (0, a.jsx)(eh.T, {
                              value: g.currentValue,
                              onChange: (e) => P(g.id, e.target.value),
                              className: "text-sm min-h-[80px]",
                            }),
                        (0, a.jsxs)("div", {
                          className: "grid grid-cols-2 gap-2",
                          children: [
                            (0, a.jsxs)("div", {
                              className: "space-y-1",
                              children: [
                                (0, a.jsx)(ef.J, {
                                  className: "text-xs text-muted-foreground",
                                  children: ez("pageEditor.fontFamily"),
                                }),
                                (0, a.jsx)(eS.R, {
                                  value: g.fontFamily || "inherit",
                                  onValueChange: (e) => I(g.id, "fontFamily", e),
                                  triggerClassName: "w-full",
                                }),
                              ],
                            }),
                            (0, a.jsxs)("div", {
                              className: "space-y-1",
                              children: [
                                (0, a.jsx)(ef.J, {
                                  className: "text-xs text-muted-foreground",
                                  children: ez("pageEditor.fontSize"),
                                }),
                                (0, a.jsxs)("div", {
                                  className: "flex items-center gap-1",
                                  children: [
                                    (0, a.jsx)(u.$, {
                                      variant: "outline",
                                      size: "icon",
                                      className: "h-8 w-8 shrink-0",
                                      onClick: () => {
                                        let e = y(g.fontSize) || 16,
                                          t = Math.max(1, e - (e > 40 ? 4 : e > 20 ? 2 : 1));
                                        I(g.id, "fontSize", "".concat(t, "px"));
                                      },
                                      children: (0, a.jsx)("span", { className: "text-xs font-bold", children: "−" }),
                                    }),
                                    (0, a.jsx)("input", {
                                      type: "number",
                                      min: 1,
                                      max: 999,
                                      className:
                                        "h-8 w-16 rounded-md border border-input bg-background px-2 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                      value: null != (d = y(g.fontSize)) ? d : "",
                                      placeholder: "auto",
                                      onChange: (e) => {
                                        let t = e.target.value;
                                        if ("" === t) I(g.id, "fontSize", "inherit");
                                        else {
                                          let e = parseInt(t, 10);
                                          !isNaN(e) && e > 0 && I(g.id, "fontSize", "".concat(e, "px"));
                                        }
                                      },
                                    }),
                                    (0, a.jsx)(u.$, {
                                      variant: "outline",
                                      size: "icon",
                                      className: "h-8 w-8 shrink-0",
                                      onClick: () => {
                                        let e = y(g.fontSize) || 16,
                                          t = Math.min(999, e + (e >= 40 ? 4 : e >= 20 ? 2 : 1));
                                        I(g.id, "fontSize", "".concat(t, "px"));
                                      },
                                      children: (0, a.jsx)("span", { className: "text-xs font-bold", children: "+" }),
                                    }),
                                  ],
                                }),
                                (0, a.jsx)("div", {
                                  className: "flex flex-wrap gap-1 mt-1",
                                  children: [12, 16, 20, 24, 32, 40, 48, 64, 80, 96].map((e) =>
                                    (0, a.jsx)(
                                      "button",
                                      {
                                        type: "button",
                                        className: "px-1.5 py-0.5 text-[10px] rounded border transition-colors ".concat(
                                          y(g.fontSize) === e
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-muted/50 border-border hover:bg-muted",
                                        ),
                                        onClick: () => I(g.id, "fontSize", "".concat(e, "px")),
                                        children: e,
                                      },
                                      e,
                                    ),
                                  ),
                                }),
                              ],
                            }),
                          ],
                        }),
                        (0, a.jsxs)("div", {
                          className: "flex items-center gap-1.5",
                          children: [
                            (0, a.jsx)("div", {
                              className: "relative flex-shrink-0",
                              children: (0, a.jsx)("input", {
                                type: "color",
                                value: g.color || "#000000",
                                onChange: (e) => I(g.id, "color", e.target.value),
                                className:
                                  "w-7 h-7 rounded cursor-pointer border border-input hover:border-primary transition-colors",
                                style: { padding: 0 },
                              }),
                            }),
                            $.slice(0, 10).map((e) =>
                              (0, a.jsx)(
                                "button",
                                {
                                  type: "button",
                                  className: (0, o.cn)(
                                    "w-5 h-5 rounded-full border transition-all hover:scale-110 flex-shrink-0",
                                    g.color === e
                                      ? "ring-2 ring-primary ring-offset-1 border-primary"
                                      : "border-transparent hover:border-muted-foreground/30",
                                  ),
                                  style: { backgroundColor: e },
                                  onClick: () => I(g.id, "color", e),
                                },
                                e,
                              ),
                            ),
                          ],
                        }),
                        (0, a.jsx)("div", {
                          className: "flex gap-1",
                          children: [
                            { value: "inherit", label: "-" },
                            { value: "300", label: "L" },
                            { value: "400", label: "N" },
                            { value: "500", label: "M" },
                            { value: "600", label: "SB" },
                            { value: "700", label: "B" },
                          ].map((e) =>
                            (0, a.jsx)(
                              "button",
                              {
                                type: "button",
                                onClick: () => I(g.id, "fontWeight", e.value),
                                className: (0, o.cn)(
                                  "flex-1 h-7 text-xs rounded-md border transition-all",
                                  g.fontWeight !== e.value && (g.fontWeight || "inherit" !== e.value)
                                    ? "bg-background hover:bg-muted border-input"
                                    : "bg-primary text-primary-foreground border-primary",
                                ),
                                style: { fontWeight: "inherit" === e.value ? 400 : Number(e.value) },
                                children: e.label,
                              },
                              e.value,
                            ),
                          ),
                        }),
                        (0, a.jsxs)("div", {
                          className: "grid grid-cols-2 gap-2",
                          children: [
                            (0, a.jsxs)("div", {
                              className: "space-y-1",
                              children: [
                                (0, a.jsx)(ef.J, {
                                  className: "text-xs text-muted-foreground",
                                  children: ez("pageEditor.letterSpacing"),
                                }),
                                (0, a.jsxs)("div", {
                                  className: "flex items-center gap-1",
                                  children: [
                                    (0, a.jsx)(u.$, {
                                      variant: "outline",
                                      size: "icon",
                                      className: "h-7 w-7 shrink-0",
                                      onClick: () => {
                                        let e = g.letterSpacing,
                                          t = Math.round(((e ? parseFloat(e) : 0) - 0.5) * 10) / 10;
                                        I(g.id, "letterSpacing", "".concat(t, "px"));
                                      },
                                      children: (0, a.jsx)("span", { className: "text-xs font-bold", children: "−" }),
                                    }),
                                    (0, a.jsx)("input", {
                                      type: "number",
                                      step: 0.5,
                                      className:
                                        "h-7 w-14 rounded-md border border-input bg-background px-1.5 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                      value: g.letterSpacing ? parseFloat(g.letterSpacing) : "",
                                      placeholder: "auto",
                                      onChange: (e) => {
                                        let t = e.target.value;
                                        if ("" === t) I(g.id, "letterSpacing", "inherit");
                                        else {
                                          let e = parseFloat(t);
                                          isNaN(e) || I(g.id, "letterSpacing", "".concat(e, "px"));
                                        }
                                      },
                                    }),
                                    (0, a.jsx)(u.$, {
                                      variant: "outline",
                                      size: "icon",
                                      className: "h-7 w-7 shrink-0",
                                      onClick: () => {
                                        let e = g.letterSpacing,
                                          t = Math.round(((e ? parseFloat(e) : 0) + 0.5) * 10) / 10;
                                        I(g.id, "letterSpacing", "".concat(t, "px"));
                                      },
                                      children: (0, a.jsx)("span", { className: "text-xs font-bold", children: "+" }),
                                    }),
                                  ],
                                }),
                              ],
                            }),
                            (0, a.jsxs)("div", {
                              className: "space-y-1",
                              children: [
                                (0, a.jsx)(ef.J, {
                                  className: "text-xs text-muted-foreground",
                                  children: ez("pageEditor.lineHeight"),
                                }),
                                (0, a.jsxs)("div", {
                                  className: "flex items-center gap-1",
                                  children: [
                                    (0, a.jsx)(u.$, {
                                      variant: "outline",
                                      size: "icon",
                                      className: "h-7 w-7 shrink-0",
                                      onClick: () => {
                                        let e = g.lineHeight,
                                          t = Math.max(0.5, Math.round(((e ? parseFloat(e) : 1.4) - 0.1) * 10) / 10);
                                        I(g.id, "lineHeight", "".concat(t));
                                      },
                                      children: (0, a.jsx)("span", { className: "text-xs font-bold", children: "−" }),
                                    }),
                                    (0, a.jsx)("input", {
                                      type: "number",
                                      step: 0.1,
                                      min: 0.5,
                                      max: 5,
                                      className:
                                        "h-7 w-14 rounded-md border border-input bg-background px-1.5 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                      value: g.lineHeight && "inherit" !== g.lineHeight ? parseFloat(g.lineHeight) : "",
                                      placeholder: "auto",
                                      onChange: (e) => {
                                        let t = e.target.value;
                                        if ("" === t) I(g.id, "lineHeight", "inherit");
                                        else {
                                          let e = parseFloat(t);
                                          !isNaN(e) && e >= 0.5 && I(g.id, "lineHeight", "".concat(e));
                                        }
                                      },
                                    }),
                                    (0, a.jsx)(u.$, {
                                      variant: "outline",
                                      size: "icon",
                                      className: "h-7 w-7 shrink-0",
                                      onClick: () => {
                                        let e = g.lineHeight,
                                          t = Math.min(5, Math.round(((e ? parseFloat(e) : 1.4) + 0.1) * 10) / 10);
                                        I(g.id, "lineHeight", "".concat(t));
                                      },
                                      children: (0, a.jsx)("span", { className: "text-xs font-bold", children: "+" }),
                                    }),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        }),
                        (0, a.jsxs)(eb.Nt, {
                          children: [
                            (0, a.jsx)(eb.R6, {
                              asChild: !0,
                              children: (0, a.jsxs)("button", {
                                type: "button",
                                className:
                                  "w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors",
                                children: [
                                  (0, a.jsx)(ed.A, { className: "h-3 w-3" }),
                                  (0, a.jsx)("span", { children: ez("pageEditor.advancedStyles") }),
                                ],
                              }),
                            }),
                            (0, a.jsx)(eb.Ke, {
                              children: (0, a.jsxs)("div", {
                                className: "space-y-3 pt-2 border-t",
                                children: [
                                  (0, a.jsxs)("div", {
                                    className: "space-y-2",
                                    children: [
                                      (0, a.jsx)("div", {
                                        className: "flex gap-2 items-center",
                                        children: (0, a.jsx)(ep.p, {
                                          type: "text",
                                          value: g.color || "",
                                          onChange: (e) => I(g.id, "color", e.target.value),
                                          placeholder: "#000000",
                                          className: "w-28 h-8 text-xs font-mono",
                                        }),
                                      }),
                                      (0, a.jsx)("div", {
                                        className: "grid grid-cols-11 gap-1",
                                        children: $.map((e) =>
                                          (0, a.jsx)(
                                            "button",
                                            {
                                              type: "button",
                                              className: (0, o.cn)(
                                                "w-5 h-5 rounded-md border-2 transition-all hover:scale-110",
                                                g.color === e
                                                  ? "ring-2 ring-primary ring-offset-1 border-primary"
                                                  : "border-transparent hover:border-muted-foreground/30",
                                              ),
                                              style: { backgroundColor: e },
                                              onClick: () => I(g.id, "color", e),
                                            },
                                            e,
                                          ),
                                        ),
                                      }),
                                    ],
                                  }),
                                  g.fontFamily &&
                                    "inherit" !== g.fontFamily &&
                                    G > 1 &&
                                    (0, a.jsxs)(u.$, {
                                      variant: "ghost",
                                      size: "sm",
                                      className:
                                        "h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground w-full",
                                      onClick: () => W(g.fontFamily),
                                      children: [
                                        (0, a.jsx)(eu.A, { className: "h-3 w-3 mr-1" }),
                                        ez("pageEditor.applyFontToAllPages"),
                                      ],
                                    }),
                                ],
                              }),
                            }),
                          ],
                        }),
                      ],
                    }),
              }),
            }),
          ],
        });
      });
      function e$(e) {
        let {
            elements: t,
            openElementId: n,
            setOpenElementId: r,
            setHoveredElementId: l,
            deleteElement: i,
            duplicateElement: s,
            showAI: c,
            onSwitchToAI: d,
            compact: p = !1,
            onExpand: h,
            scrollable: f = !0,
            isUploading: x,
            isRemovingBg: b,
            searchingImageId: v,
            searchResults: y,
            customSearchQuery: w,
            isProxyUploading: j,
            imageSource: N,
            onUpload: E,
            onRemoveBg: k,
            onSearch: S,
            onLoadMore: C,
            searchHasMore: A,
            loadingMoreImageId: R,
            onSearchQueryChange: T,
            onSelectSearchedImage: z,
            onClearSearchResults: H,
            onUpdateValue: F,
            onUpdateStyle: M,
            onImageSourceChange: L,
            workspaceLogos: P,
            onSelectLogo: I,
            onApplyLogoToAllPages: D,
            onApplyFontToAllPages: U,
            onClearRichText: O,
            totalPages: V,
            workspaceAssets: W,
            onSelectAsset: X,
            onUploadAsset: Y,
            onDeleteAsset: B,
            isUploadingAsset: $,
            onOpenAdvancedEditor: q,
            getAiImageGenerateState: _,
            onAiImagePromptChange: J,
            onAiImageRatioChange: K,
            onAiImageReferenceImageUrlChange: Q,
            onAiImageReferenceUploadStateChange: Z,
            onAiImageNumImagesChange: ee,
            onAiImageGenerate: et,
            sandboxMode: en,
            publicMode: ea,
            addElement: er,
            t: em,
          } = e,
          ep = p ? "w-6 h-6" : "w-7 h-7",
          eh = p ? "h-3 w-3" : "h-3.5 w-3.5",
          ef = p ? "p-2" : "p-2.5",
          ex = p ? "gap-2.5" : "gap-3",
          eb = p ? "text-xs" : "text-sm",
          ev = p ? "h-3.5 w-3.5" : "h-4 w-4",
          ey = p ? "h-6" : "h-7",
          ew = p ? "text-[10px]" : "text-xs",
          ej = p ? "h-3 w-3" : "h-3.5 w-3.5",
          eN = p ? "px-2 pb-2" : "px-3 pb-3",
          eE = p ? "py-1" : "py-1.5",
          ek = p ? 30 : 40,
          eS =
            !en && er
              ? (0, a.jsxs)("div", {
                  className: (0, o.cn)(p ? "px-3 py-2" : "px-4 py-3", "border-t"),
                  children: [
                    (0, a.jsx)("p", {
                      className: (0, o.cn)("text-muted-foreground mb-1.5", p ? "text-[10px]" : "text-xs"),
                      children: em("pageEditor.addElement"),
                    }),
                    (0, a.jsxs)("div", {
                      className: "flex gap-1.5",
                      children: [
                        (0, a.jsxs)("button", {
                          type: "button",
                          onClick: () => er("text"),
                          className: (0, o.cn)(
                            "flex-1 flex items-center justify-center gap-1 rounded-md border border-dashed transition-colors",
                            "text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-muted/50",
                            p ? "py-1.5 text-[10px]" : "py-2 text-xs",
                          ),
                          children: [
                            (0, a.jsx)(ei.A, { className: p ? "h-3 w-3" : "h-3.5 w-3.5" }),
                            em("pageEditor.addText"),
                          ],
                        }),
                        (0, a.jsxs)("button", {
                          type: "button",
                          onClick: () => er("image-slot"),
                          className: (0, o.cn)(
                            "flex-1 flex items-center justify-center gap-1 rounded-md border border-dashed transition-colors",
                            "text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-muted/50",
                            p ? "py-1.5 text-[10px]" : "py-2 text-xs",
                          ),
                          children: [
                            (0, a.jsx)(es.A, { className: p ? "h-3 w-3" : "h-3.5 w-3.5" }),
                            em("pageEditor.addImageSlot"),
                          ],
                        }),
                        (0, a.jsxs)("button", {
                          type: "button",
                          onClick: () => er("logo-slot"),
                          className: (0, o.cn)(
                            "flex-1 flex items-center justify-center gap-1 rounded-md border border-dashed transition-colors",
                            "text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-muted/50",
                            p ? "py-1.5 text-[10px]" : "py-2 text-xs",
                          ),
                          children: [
                            (0, a.jsx)(eo.A, { className: p ? "h-3 w-3" : "h-3.5 w-3.5" }),
                            em("pageEditor.addLogoSlot"),
                          ],
                        }),
                      ],
                    }),
                  ],
                })
              : null,
          eC = (0, a.jsx)("div", {
            className: (0, o.cn)(p ? "px-3 py-2" : "px-4 py-3", "space-y-1.5"),
            children: t.map((e) => {
              let t = "image" === e.type || "image-slot" === e.type,
                c = "image-slot" === e.type,
                d = "div" === e.type,
                g = e.id === n,
                f = d
                  ? em("pageEditor.designElement")
                  : c
                    ? e.slotLabel || em("pageEditor.imageArea")
                    : "image" === e.type
                      ? em("pageEditor.image")
                      : e.currentValue.length > ek
                        ? e.currentValue.substring(0, ek) + "..."
                        : e.currentValue;
              return (0, a.jsxs)(
                "div",
                {
                  className: (0, o.cn)(
                    "rounded-lg border transition-all bg-background",
                    g && "border-primary/50 shadow-sm",
                  ),
                  onMouseEnter: p ? void 0 : () => l(e.id),
                  onMouseLeave: p ? void 0 : () => l(null),
                  children: [
                    (0, a.jsxs)("button", {
                      type: "button",
                      className: (0, o.cn)(
                        "w-full flex items-center text-left transition-all rounded-lg",
                        ex,
                        ef,
                        g ? "bg-muted/30" : p ? "" : "hover:bg-muted/50",
                      ),
                      onClick: () => {
                        (r(g ? null : e.id), !g && h && h());
                      },
                      children: [
                        (0, a.jsx)("div", {
                          className: (0, o.cn)(
                            "flex-shrink-0 rounded flex items-center justify-center",
                            ep,
                            p ? "rounded" : "rounded-md",
                            t
                              ? "bg-blue-100 text-blue-600"
                              : d
                                ? "bg-orange-100 text-orange-600"
                                : "bg-green-100 text-green-600",
                          ),
                          children: t
                            ? (0, a.jsx)(ec.A, { className: eh })
                            : d
                              ? (0, a.jsx)(m.A, { className: eh })
                              : (0, a.jsx)(ei.A, { className: eh }),
                        }),
                        (0, a.jsx)("span", { className: (0, o.cn)("flex-1 min-w-0 truncate", eb), children: f }),
                        (0, a.jsx)(ed.A, {
                          className: (0, o.cn)(
                            "text-muted-foreground transition-transform flex-shrink-0",
                            ev,
                            g && "rotate-180",
                          ),
                        }),
                      ],
                    }),
                    g &&
                      (0, a.jsxs)("div", {
                        className: (0, o.cn)(eN, "border-t border-border/50"),
                        children: [
                          (0, a.jsxs)("div", {
                            className: (0, o.cn)("flex items-center justify-end gap-1", eE),
                            children: [
                              (0, a.jsxs)(u.$, {
                                variant: "ghost",
                                size: "sm",
                                className: (0, o.cn)(
                                  ey,
                                  "px-2 text-muted-foreground hover:text-foreground hover:bg-muted",
                                ),
                                onClick: (t) => {
                                  (t.stopPropagation(), s(e.id));
                                },
                                children: [
                                  (0, a.jsx)(eu.A, { className: (0, o.cn)(ej, "mr-1") }),
                                  (0, a.jsx)("span", { className: ew, children: em("pageEditor.duplicateElement") }),
                                ],
                              }),
                              (0, a.jsxs)(u.$, {
                                variant: "ghost",
                                size: "sm",
                                className: (0, o.cn)(
                                  ey,
                                  "px-2 text-destructive hover:text-destructive hover:bg-destructive/10",
                                ),
                                onClick: (t) => {
                                  (t.stopPropagation(), i(e.id), r(null));
                                },
                                children: [
                                  (0, a.jsx)(G.A, { className: (0, o.cn)(ej, "mr-1") }),
                                  (0, a.jsx)("span", { className: ew, children: em("pageEditor.deleteElement") }),
                                ],
                              }),
                            ],
                          }),
                          (0, a.jsx)(eB, {
                            element: e,
                            isOpen: !0,
                            onToggle: () => {},
                            hideHeader: !p || void 0,
                            onHover: l,
                            isUploading: x,
                            isRemovingBg: b,
                            searchingImageId: v,
                            searchResults: y,
                            customSearchQuery: w,
                            isProxyUploading: j,
                            imageSource: N,
                            onUpload: E,
                            onRemoveBg: k,
                            onSearch: S,
                            onLoadMore: C,
                            searchHasMore: A,
                            loadingMoreImageId: R,
                            onSearchQueryChange: T,
                            onSelectSearchedImage: z,
                            onClearSearchResults: H,
                            onUpdateValue: F,
                            onUpdateStyle: M,
                            onImageSourceChange: L,
                            workspaceLogos: P,
                            onSelectLogo: I,
                            onApplyLogoToAllPages: D,
                            onApplyFontToAllPages: U,
                            onDelete: i,
                            onClearRichText: O,
                            totalPages: V,
                            workspaceAssets: W,
                            onSelectAsset: X,
                            onUploadAsset: Y,
                            onDeleteAsset: B,
                            isUploadingAsset: $,
                            onOpenAdvancedEditor: q,
                            aiImageGenerateState: _(e.id),
                            onAiImagePromptChange: J,
                            onAiImageRatioChange: K,
                            onAiImageReferenceImageUrlChange: Q,
                            onAiImageReferenceUploadStateChange: Z,
                            onAiImageNumImagesChange: ee,
                            onAiImageGenerate: et,
                            sandboxMode: en,
                            publicMode: ea,
                            t: em,
                          }),
                        ],
                      }),
                  ],
                },
                e.id,
              );
            }),
          });
        return f
          ? (0, a.jsxs)("div", {
              className: "flex-1 overflow-hidden min-h-0 flex flex-col",
              children: [
                c &&
                  !n &&
                  (0, a.jsx)("div", {
                    className: "px-4 py-2.5 bg-violet-500/5 border-b flex-shrink-0",
                    children: (0, a.jsxs)("button", {
                      onClick: d,
                      className:
                        "w-full flex items-center justify-center gap-2 text-xs text-violet-600 hover:text-violet-700 transition-colors",
                      children: [
                        (0, a.jsx)(g.A, { className: "h-3.5 w-3.5" }),
                        (0, a.jsx)("span", { children: em("refinement.aiHint") }),
                        (0, a.jsx)(eg.A, { className: "h-3 w-3" }),
                      ],
                    }),
                  }),
                (0, a.jsx)(el.F, { className: "flex-1 min-h-0", children: eC }),
                eS,
              ],
            })
          : (0, a.jsxs)(a.Fragment, { children: [eC, eS] });
      }
      var eq = n(96279),
        e_ = n(16385),
        eG = n(93303),
        eJ = n(87865),
        eK = n(49523);
      function eQ(e) {
        let {
          currentPageIndex: t,
          totalPages: n,
          onNavigate: r,
          canUndo: l,
          canRedo: i,
          onUndo: s,
          onRedo: o,
          undoCount: d = 0,
          redoCount: g = 0,
          pageNumber: m,
          onSave: p,
          onSaveAndClose: f,
          t: x,
        } = e;
        return (0, a.jsx)(c.c7, {
          className: "px-6 py-4 border-b flex-shrink-0",
          children: (0, a.jsxs)("div", {
            className: "flex items-center justify-between",
            children: [
              (0, a.jsxs)("div", {
                className: "flex items-center gap-3",
                children: [
                  (0, a.jsx)(c.L3, { children: x("pageEditor.title", { pageNumber: m }) }),
                  n > 1 &&
                    (0, a.jsxs)("div", {
                      className: "flex items-center gap-1 ml-2",
                      children: [
                        (0, a.jsx)(u.$, {
                          variant: "ghost",
                          size: "sm",
                          className: "h-8 px-2",
                          onClick: () => r(t - 1),
                          disabled: 0 === t,
                          children: (0, a.jsx)(e_.A, { className: "h-4 w-4" }),
                        }),
                        (0, a.jsx)("span", {
                          className: "text-sm text-muted-foreground min-w-[60px] text-center",
                          children: x("pageEditor.pageOf", { current: t + 1, total: n }),
                        }),
                        (0, a.jsx)(u.$, {
                          variant: "ghost",
                          size: "sm",
                          className: "h-8 px-2",
                          onClick: () => r(t + 1),
                          disabled: t === n - 1,
                          children: (0, a.jsx)(eg.A, { className: "h-4 w-4" }),
                        }),
                      ],
                    }),
                ],
              }),
              (0, a.jsxs)("div", {
                className: "flex items-center gap-2",
                children: [
                  (0, a.jsx)(eq.Bc, {
                    delayDuration: 300,
                    children: (0, a.jsxs)("div", {
                      className: "flex items-center gap-1 mr-2",
                      children: [
                        (0, a.jsxs)(eq.m_, {
                          children: [
                            (0, a.jsx)(eq.k$, {
                              asChild: !0,
                              children: (0, a.jsx)(u.$, {
                                variant: "ghost",
                                size: "sm",
                                className: "h-8 w-8 p-0",
                                onClick: s,
                                disabled: !l,
                                children: (0, a.jsx)(eG.A, { className: "h-4 w-4" }),
                              }),
                            }),
                            (0, a.jsxs)(eq.ZI, {
                              side: "bottom",
                              children: [
                                (0, a.jsxs)("p", { children: [x("pageEditor.undo"), " (Ctrl+Z)"] }),
                                d > 0 &&
                                  (0, a.jsxs)("p", {
                                    className: "text-xs text-muted-foreground",
                                    children: [d, " ", x("pageEditor.stepsAvailable")],
                                  }),
                              ],
                            }),
                          ],
                        }),
                        (0, a.jsxs)(eq.m_, {
                          children: [
                            (0, a.jsx)(eq.k$, {
                              asChild: !0,
                              children: (0, a.jsx)(u.$, {
                                variant: "ghost",
                                size: "sm",
                                className: "h-8 w-8 p-0",
                                onClick: o,
                                disabled: !i,
                                children: (0, a.jsx)(eJ.A, { className: "h-4 w-4" }),
                              }),
                            }),
                            (0, a.jsxs)(eq.ZI, {
                              side: "bottom",
                              children: [
                                (0, a.jsxs)("p", { children: [x("pageEditor.redo"), " (Ctrl+Shift+Z)"] }),
                                g > 0 &&
                                  (0, a.jsxs)("p", {
                                    className: "text-xs text-muted-foreground",
                                    children: [g, " ", x("pageEditor.stepsAvailable")],
                                  }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  }),
                  (0, a.jsxs)(u.$, {
                    variant: "outline",
                    size: "sm",
                    onClick: p,
                    children: [(0, a.jsx)(eK.A, { className: "h-4 w-4 mr-2" }), x("pageEditor.save")],
                  }),
                  (0, a.jsxs)(u.$, {
                    size: "sm",
                    onClick: f,
                    children: [(0, a.jsx)(h.A, { className: "h-4 w-4 mr-2" }), x("pageEditor.saveAndClose")],
                  }),
                ],
              }),
            ],
          }),
        });
      }
      function eZ(e) {
        let {
          currentPageIndex: t,
          totalPages: n,
          onNavigate: r,
          canUndo: l,
          canRedo: i,
          onUndo: s,
          onRedo: o,
          pageNumber: c,
          onSaveAndClose: d,
          t: g,
        } = e;
        return (0, a.jsxs)("div", {
          className: "flex items-center justify-between px-3 py-2 border-b flex-shrink-0",
          children: [
            (0, a.jsx)("span", {
              className: "font-medium text-sm",
              children: g("pageEditor.title", { pageNumber: c }),
            }),
            (0, a.jsxs)("div", {
              className: "flex items-center gap-1",
              children: [
                n > 1 &&
                  (0, a.jsxs)(a.Fragment, {
                    children: [
                      (0, a.jsx)(u.$, {
                        variant: "ghost",
                        size: "sm",
                        className: "h-8 w-8 p-0",
                        onClick: () => r(t - 1),
                        disabled: 0 === t,
                        children: (0, a.jsx)(e_.A, { className: "h-4 w-4" }),
                      }),
                      (0, a.jsxs)("span", {
                        className: "text-xs text-muted-foreground min-w-[32px] text-center",
                        children: [t + 1, "/", n],
                      }),
                      (0, a.jsx)(u.$, {
                        variant: "ghost",
                        size: "sm",
                        className: "h-8 w-8 p-0",
                        onClick: () => r(t + 1),
                        disabled: t === n - 1,
                        children: (0, a.jsx)(eg.A, { className: "h-4 w-4" }),
                      }),
                    ],
                  }),
                (0, a.jsx)(u.$, {
                  variant: "ghost",
                  size: "sm",
                  className: "h-8 w-8 p-0",
                  onClick: s,
                  disabled: !l,
                  children: (0, a.jsx)(eG.A, { className: "h-4 w-4" }),
                }),
                (0, a.jsx)(u.$, {
                  variant: "ghost",
                  size: "sm",
                  className: "h-8 w-8 p-0",
                  onClick: o,
                  disabled: !i,
                  children: (0, a.jsx)(eJ.A, { className: "h-4 w-4" }),
                }),
                (0, a.jsx)(u.$, {
                  variant: "ghost",
                  size: "sm",
                  className: "h-8 w-8 p-0",
                  onClick: d,
                  children: (0, a.jsx)(ey.A, { className: "h-4 w-4" }),
                }),
              ],
            }),
          ],
        });
      }
      function e0(e) {
        let { html: t, label: n = "HTML" } = e;
        return null;
      }
      n(88463);
      let e1 = (0, l.default)(
          () =>
            Promise.all([n.e(22259), n.e(87851), n.e(79937)])
              .then(n.bind(n, 79937))
              .then((e) => e.AIChatPanel),
          {
            loadableGenerated: { webpack: () => [79937] },
            ssr: !1,
            loading: () =>
              (0, a.jsx)("div", {
                className: "flex h-full min-h-[220px] items-center justify-center",
                children: (0, a.jsx)(g.A, { className: "h-5 w-5 animate-pulse text-muted-foreground" }),
              }),
          },
        ),
        e5 = (0, l.default)(
          () =>
            Promise.all([n.e(22259), n.e(87851), n.e(26402)])
              .then(n.bind(n, 26402))
              .then((e) => e.ImageEditor),
          {
            loadableGenerated: { webpack: () => [26402] },
            ssr: !1,
            loading: () =>
              (0, a.jsx)("div", {
                className: "fixed inset-0 z-[10001] flex items-center justify-center bg-background/80 backdrop-blur-sm",
                children: (0, a.jsx)(g.A, { className: "h-5 w-5 animate-pulse text-muted-foreground" }),
              }),
          },
        );
      function e3(e) {
        let {
            open: t,
            onClose: l,
            pages: b,
            initialPageIndex: y = 0,
            aspectRatio: w,
            onSaveAll: j,
            cachedImageUrls: E,
            getCachedImageUrl: k,
            renderPageToImage: S,
            sandboxMode: C = !1,
            publicAIMode: T = !1,
          } = e,
          M = (0, s.useTranslations)("CarouselLab"),
          P = !C || T,
          X = !C || T,
          Y = T ? "/api/v1/carousel-lab/public" : "/api/v1/carousel-lab";
        (0, r.useEffect)(() => {
          if (!t) return;
          let e = (e) => {
            e.preventDefault();
          };
          return (window.addEventListener("beforeunload", e), () => window.removeEventListener("beforeunload", e));
        }, [t]);
        let [B, $] = (0, r.useState)(y),
          q = (0, r.useRef)(B);
        q.current = B;
        let [_, G] = (0, r.useState)(!1),
          [J, K] = (0, r.useState)("manual"),
          [el, ei] = (0, r.useState)(!0);
        ((0, r.useEffect)(() => {
          let e = () => G(window.innerWidth < 768);
          return (e(), window.addEventListener("resize", e), () => window.removeEventListener("resize", e));
        }, []),
          (0, r.useEffect)(() => {
            if (t && _) {
              ei(!0);
              let e = setTimeout(() => ei(!1), 3e3);
              return () => clearTimeout(e);
            }
          }, [t, _]));
        let es = (function () {
            let { toolbarHeight: e = 56, initialSnap: t = "collapsed" } =
                arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
              n = (0, et.E)(),
              [a, l] = (0, r.useState)(t),
              i = (0, r.useRef)(ea(t, e)),
              s = (0, r.useRef)(t),
              o = (0, r.useCallback)(
                (t) => {
                  let a = ea(t, e);
                  (l(t), (s.current = t), (i.current = a), n.start({ height: a, transition: en }));
                },
                [e, n],
              ),
              c = (0, r.useCallback)(
                (t, n) => {
                  let a = ["collapsed", "mid", "expanded"];
                  if (Math.abs(n) > 0.5) {
                    let e = a.indexOf(s.current);
                    return n < 0 ? a[Math.max(0, e - 1)] : a[Math.min(a.length - 1, e + 1)];
                  }
                  let r = a[0],
                    l = 1 / 0;
                  for (let n of a) {
                    let a = Math.abs(t - ea(n, e));
                    a < l && ((l = a), (r = n));
                  }
                  return r;
                },
                [e],
              ),
              d = (0, r.useCallback)(
                (t) => {
                  t.preventDefault();
                  let a = t.clientY,
                    r = i.current,
                    l = Date.now(),
                    s = ea("collapsed", e),
                    d = ea("expanded", e),
                    u = (e) => {
                      let t = Math.max(s, Math.min(d, r + (a - e.clientY)));
                      ((i.current = t), n.set({ height: t }));
                    },
                    g = (e) => {
                      (document.removeEventListener("pointermove", u), document.removeEventListener("pointerup", g));
                      let t = Date.now() - l,
                        n = a - e.clientY;
                      o(c(i.current, t > 0 ? n / t : 0));
                    };
                  (document.addEventListener("pointermove", u), document.addEventListener("pointerup", g));
                },
                [e, n, c, o],
              );
            return {
              controls: n,
              currentSnap: a,
              snapTo: o,
              onPointerDown: d,
              getSnapHeight: (t) => ea(t, e),
              initialHeight: ea(t, e),
            };
          })({ initialSnap: "mid" }),
          eo = t && X,
          { data: ec = [], isLoading: ed } = (0, f.vC)("logo", { enabled: eo }),
          {
            pageStates: eu,
            setPageStates: eg,
            currentState: em,
            currentPage: ep,
            baseHtml: eh,
            elements: ef,
            previewHtml: ex,
            canUndo: eb,
            canRedo: ev,
            undoCount: ey,
            redoCount: ew,
            undo: ej,
            redo: eN,
            setElements: eE,
            setBaseHtml: ek,
            setPreviewHtml: eS,
            updateElement: eC,
            updateElementRichtext: eA,
            clearRichText: eR,
            deleteElement: eT,
            duplicateElement: ez,
            addElement: eH,
            updateElementStyle: eF,
            applyLogoToAllPages: eM,
            applyFontToAllPages: eL,
            resetOnReopenRef: eP,
            flushPendingHistory: eI,
            pushToHistory: eD,
            _clampPageIndex: eU,
          } = (function (e) {
            var t, n;
            let {
                pages: a,
                open: l,
                initialPageIndex: i,
                currentPageIndex: o,
                workspaceLogos: c,
                isLoadingLogos: d,
              } = e,
              u = (0, s.useTranslations)("CarouselLab"),
              [g, m] = (0, r.useState)(() => {
                let e = new Map();
                return (
                  a.forEach((t, n) => {
                    let a = N(t.html);
                    e.set(n, { baseHtml: a.html, elements: a.elements, previewHtml: a.html });
                  }),
                  e
                );
              }),
              p = (0, H.EA)((e) => e.loadedGenerationId),
              h = (0, r.useRef)({ past: [], future: [] }),
              [f, b] = (0, r.useState)(0),
              y = (0, r.useRef)(null),
              w = (0, r.useRef)(null),
              j = (0, r.useRef)(null),
              E = (0, r.useRef)(null),
              k = (0, r.useRef)(g);
            ((0, r.useEffect)(() => {
              k.current = g;
            }, [g]),
              (0, r.useEffect)(() => {
                let e = () => {
                    D(p, h.current.past, h.current.future, k.current);
                  },
                  t = window.innerWidth < 768 ? 1800 : 1e3;
                return (
                  w.current && clearTimeout(w.current),
                  null !== j.current && "cancelIdleCallback" in window && window.cancelIdleCallback(j.current),
                  (w.current = setTimeout(() => {
                    if ("requestIdleCallback" in window) {
                      j.current = window.requestIdleCallback(
                        () => {
                          ((j.current = null), e());
                        },
                        { timeout: 1500 },
                      );
                      return;
                    }
                    e();
                  }, t)),
                  () => {
                    (w.current && clearTimeout(w.current),
                      null !== j.current &&
                        "cancelIdleCallback" in window &&
                        (window.cancelIdleCallback(j.current), (j.current = null)));
                  }
                );
              }, [f, p]),
              (0, r.useEffect)(() => {
                let e = () => {
                  D(p, h.current.past, h.current.future, k.current);
                };
                return (
                  window.addEventListener("beforeunload", e),
                  () => window.removeEventListener("beforeunload", e)
                );
              }, [p]));
            let S = (0, r.useCallback)(
                (e) => ({
                  baseHtml: e.baseHtml,
                  elements: e.elements.map((e) => ({ ...e })),
                  previewHtml: e.previewHtml,
                }),
                [],
              ),
              C = (0, r.useCallback)(() => {
                (y.current && (clearTimeout(y.current), (y.current = null)),
                  E.current &&
                    (h.current.past.push(E.current),
                    h.current.past.length > 50 && (h.current.past = h.current.past.slice(-50)),
                    (h.current.future = []),
                    (E.current = null)));
              }, []),
              A = (0, r.useCallback)(
                (e, t) => {
                  if ((y.current && clearTimeout(y.current), !E.current)) {
                    let n = e.get(t);
                    n && (E.current = { kind: "single", pageIndex: t, state: S(n) });
                  }
                  ((h.current.future = []),
                    (y.current = setTimeout(() => {
                      (C(), b((e) => e + 1));
                    }, 500)),
                    b((e) => e + 1));
                },
                [S, C],
              ),
              T = (0, r.useCallback)(
                (e) => {
                  let t = new Map();
                  return (
                    e.forEach((e, n) => {
                      t.set(n, S(e));
                    }),
                    t
                  );
                },
                [S],
              ),
              z = (0, r.useCallback)(() => {
                if ((C(), 0 === h.current.past.length)) return;
                let e = h.current.past.pop();
                if ("bulk" === e.kind) (h.current.future.unshift({ kind: "bulk", states: T(k.current) }), m(e.states));
                else {
                  let t = k.current.get(e.pageIndex);
                  (t && h.current.future.unshift({ kind: "single", pageIndex: e.pageIndex, state: S(t) }),
                    m((t) => {
                      let n = new Map(t);
                      return (n.set(e.pageIndex, e.state), n);
                    }));
                }
                b((e) => e + 1);
              }, [S, T, C]),
              M = (0, r.useCallback)(() => {
                if ((C(), 0 === h.current.future.length)) return;
                let e = h.current.future.shift();
                if ("bulk" === e.kind) (h.current.past.push({ kind: "bulk", states: T(k.current) }), m(e.states));
                else {
                  let t = k.current.get(e.pageIndex);
                  (t && h.current.past.push({ kind: "single", pageIndex: e.pageIndex, state: S(t) }),
                    m((t) => {
                      let n = new Map(t);
                      return (n.set(e.pageIndex, e.state), n);
                    }));
                }
                b((e) => e + 1);
              }, [S, T, C]),
              P = h.current.past.length > 0 || null !== E.current,
              U = h.current.future.length > 0,
              O = h.current.past.length + +(null !== E.current),
              V = h.current.future.length;
            (0, r.useEffect)(
              () => () => {
                y.current && clearTimeout(y.current);
              },
              [],
            );
            let W = (0, r.useRef)(a),
              X = (0, r.useRef)(l),
              Y = (0, r.useRef)(!1),
              B = (0, r.useRef)(null);
            (0, r.useEffect)(() => {
              let e = X.current;
              if (((X.current = l), l && !e && a !== W.current)) {
                var t;
                W.current = a;
                let e = (function (e) {
                  if (!e) return null;
                  try {
                    let t = sessionStorage.getItem(F);
                    if (!t) return null;
                    try {
                      let n = JSON.parse(t);
                      if (n.generationId !== e || Date.now() - n.timestamp > 36e5) return null;
                      let a = n.past.map(I),
                        r = n.future.map(I),
                        l = new Map(
                          n.pageStates.map((e) => {
                            let [t, n] = e;
                            return [t, L(n)];
                          }),
                        );
                      return { past: a, future: r, pageStates: l };
                    } catch (e) {
                      return null;
                    }
                  } catch (e) {
                    return null;
                  }
                })(p);
                if (
                  (function (e, t) {
                    if (!e || e.pageStates.size !== t.length) return !1;
                    for (let n = 0; n < t.length; n += 1) {
                      let a = e.pageStates.get(n),
                        r = t[n];
                      if (!a || !r) return !1;
                      let l = N(r.html);
                      if (a.baseHtml !== l.html) return !1;
                    }
                    return !0;
                  })(e, a)
                )
                  (m(e.pageStates), (h.current = { past: e.past, future: e.future }));
                else {
                  let e = new Map();
                  (a.forEach((t, n) => {
                    let a = N(t.html);
                    e.set(n, { baseHtml: a.html, elements: a.elements, previewHtml: a.html });
                  }),
                    m(e),
                    (h.current = { past: [], future: [] }));
                }
                (null == (t = B.current) || t.call(B, i), (Y.current = !0));
              }
            }, [l, a, i, p]);
            let $ = g.get(o) || {
                baseHtml: (null == (t = a[o]) ? void 0 : t.html) || "",
                elements: [],
                previewHtml: (null == (n = a[o]) ? void 0 : n.html) || "",
              },
              q = a[o],
              _ = $.baseHtml,
              G = $.elements,
              J = (0, r.useMemo)(() => R(_, G), [_, G]),
              K = (0, r.useCallback)(
                (e) => {
                  m((t) => {
                    A(t, o);
                    let n = new Map(t),
                      a = n.get(o);
                    if (a) {
                      let t = e(a.elements);
                      n.set(o, { ...a, elements: t });
                    }
                    return n;
                  });
                },
                [o, A],
              ),
              Q = (0, r.useCallback)(
                (e) => {
                  m((t) => {
                    A(t, o);
                    let n = new Map(t),
                      a = n.get(o);
                    if (a) {
                      let t = N(e);
                      n.set(o, { ...a, baseHtml: t.html, elements: t.elements, previewHtml: t.html });
                    }
                    return n;
                  });
                },
                [o, A],
              ),
              Z = (0, r.useCallback)(
                (e) => {
                  m((t) => {
                    let n = new Map(t),
                      a = n.get(o);
                    return (a && n.set(o, { ...a, previewHtml: e }), n);
                  });
                },
                [o],
              ),
              ee = (0, r.useCallback)(
                (e, t) => {
                  K((n) => n.map((n) => (n.id === e ? { ...n, currentValue: t } : n)));
                },
                [K],
              ),
              et = (0, r.useCallback)(
                (e, t) => {
                  K((n) => n.map((n) => (n.id === e ? { ...n, currentValue: t, richHtml: !0 } : n)));
                },
                [K],
              ),
              en = (0, r.useCallback)(
                (e, t) => {
                  K((n) => n.map((n) => (n.id === e ? { ...n, currentValue: t, richHtml: !1 } : n)));
                },
                [K],
              ),
              ea = (0, r.useCallback)(
                (e) => {
                  (K((t) => t.map((t) => (t.id === e ? { ...t, deleted: !0 } : t))),
                    (0, x.toast)({ description: u("pageEditor.elementDeleted") }));
                },
                [K, u],
              ),
              er = (0, r.useCallback)(
                (e) => {
                  var t;
                  let n = R($.baseHtml, $.elements),
                    a = new DOMParser().parseFromString("<body>".concat(n, "</body>"), "text/html"),
                    r = a.body.querySelector('[data-editable-id="'.concat(e, '"]'));
                  if (!r)
                    return void (0, x.toast)({
                      description: u("pageEditor.elementDuplicated"),
                      variant: "destructive",
                    });
                  let l = r.cloneNode(!0),
                    i = "".concat(e, "-dup-").concat(Date.now());
                  (l.setAttribute("data-editable-id", i),
                    l.querySelectorAll("[data-editable-id]").forEach((e) => {
                      let t = e.getAttribute("data-editable-id");
                      e.setAttribute("data-editable-id", "".concat(t, "-dup-").concat(Date.now()));
                    }),
                    l.querySelectorAll("[data-slot-id]").forEach((e) => {
                      let t = e.getAttribute("data-slot-id");
                      e.setAttribute("data-slot-id", "".concat(t, "-dup-").concat(Date.now()));
                    }),
                    l.hasAttribute("data-slot-id") &&
                      l.setAttribute(
                        "data-slot-id",
                        "".concat(l.getAttribute("data-slot-id"), "-dup-").concat(Date.now()),
                      ),
                    null == (t = r.parentNode) || t.insertBefore(l, r.nextSibling),
                    Q(a.body.innerHTML),
                    (0, x.toast)({ description: u("pageEditor.elementDuplicated") }));
                },
                [$, Q, u],
              ),
              el = (0, r.useCallback)(
                (e, t, n) => {
                  K((a) => a.map((a) => (a.id === e ? { ...a, [t]: n } : a)));
                },
                [K],
              ),
              ei = (0, r.useCallback)(
                (e) => {
                  var t, n, a, r;
                  let l = Date.now(),
                    i = "";
                  if (
                    ("text" === e
                      ? (i =
                          '<span style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 32px; font-weight: 600; color: #1a1a1a; text-align: center; white-space: nowrap; z-index: 10; cursor: pointer; pointer-events: auto;">New Text</span>')
                      : "image-slot" === e
                        ? (i = '<div class="image-slot" data-slot-id="'.concat(
                            "slot-new-".concat(l),
                            '" data-slot-type="main" data-slot-label="Image" data-search-query="abstract texture background" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 300px; height: 200px; background-image: url(\'https://placehold.co/300x200/e2e8f0/94a3b8?text=Image\'); background-size: cover; background-position: center; border-radius: 8px; z-index: 10; pointer-events: auto;"></div>',
                          ))
                        : "logo-slot" === e &&
                          (i = '<div class="image-slot" data-slot-id="'.concat(
                            "slot-logo-".concat(l),
                            '" data-slot-type="logo" data-slot-label="Logo" style="position: absolute; left: 20px; top: 20px; width: 120px; height: 60px; background-size: contain; background-repeat: no-repeat; background-position: center; background-image: url(\'https://placehold.co/120x60/e2e8f0/94a3b8?text=Logo\'); z-index: 10; pointer-events: auto;"></div>',
                          )),
                    !i)
                  )
                    return;
                  let s = R(
                      null != (a = null == (t = k.current.get(o)) ? void 0 : t.baseHtml) ? a : "",
                      null != (r = null == (n = k.current.get(o)) ? void 0 : n.elements) ? r : [],
                    ),
                    c = new DOMParser().parseFromString("<body>".concat(s, "</body>"), "text/html"),
                    d = c.body.querySelector("div") || c.body,
                    g = (function (e, t) {
                      let n = t.querySelector("[".concat(v, '="true"]'));
                      if (n instanceof HTMLElement) return n;
                      let a = e.createElement("div");
                      return (
                        a.setAttribute(v, "true"),
                        a.setAttribute(
                          "style",
                          "position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2147483000;",
                        ),
                        t.appendChild(a),
                        a
                      );
                    })(c, d),
                    m = c.createElement("div");
                  m.innerHTML = i;
                  let p = m.firstElementChild;
                  (p && g.appendChild(p),
                    Q(c.body.innerHTML),
                    (0, x.toast)({ description: u("pageEditor.elementAdded") }));
                },
                [o, Q, u],
              ),
              es = (0, r.useCallback)(
                (e) => {
                  (C(),
                    h.current.past.push({ kind: "bulk", states: T(k.current) }),
                    h.current.past.length > 50 && (h.current.past = h.current.past.slice(-50)),
                    (h.current.future = []),
                    b((e) => e + 1),
                    m((t) => {
                      let n = new Map(t);
                      return (
                        n.forEach((t, a) => {
                          let r = t.elements.map((t) => ("logo" === t.slotType ? { ...t, currentValue: e } : t));
                          n.set(a, { ...t, elements: r });
                        }),
                        n
                      );
                    }),
                    (0, x.toast)({ title: u("pageEditor.logoAppliedToAllPages") }));
                },
                [u, C, T],
              ),
              eo = (0, r.useCallback)(
                (e) => {
                  (C(),
                    h.current.past.push({ kind: "bulk", states: T(k.current) }),
                    h.current.past.length > 50 && (h.current.past = h.current.past.slice(-50)),
                    (h.current.future = []),
                    b((e) => e + 1),
                    m((t) => {
                      let n = new Map(t);
                      return (
                        n.forEach((t, a) => {
                          let r = t.elements.map((t) => ("text" === t.type ? { ...t, fontFamily: e } : t));
                          n.set(a, { ...t, elements: r });
                        }),
                        n
                      );
                    }),
                    (0, x.toast)({ title: u("pageEditor.fontAppliedToAllPages") }));
                },
                [u, C, T],
              ),
              ec = (0, r.useRef)(a);
            return (
              (0, r.useEffect)(() => {
                var e, t, n;
                let r = ec.current;
                if (((ec.current = a), r === a)) return;
                let l = !1;
                if (r.length !== a.length) l = !0;
                else
                  for (let n = 0; n < a.length; n++)
                    if ((null == (e = r[n]) ? void 0 : e.html) !== (null == (t = a[n]) ? void 0 : t.html)) {
                      l = !0;
                      break;
                    }
                if (!l) return;
                let i = (function (e, t) {
                  if (e.length !== t.length) return !0;
                  let n = new Map();
                  e.forEach((e, t) => {
                    var a;
                    let r = e.html,
                      l = null != (a = n.get(r)) ? a : [];
                    (l.push(t), n.set(r, l));
                  });
                  for (let e = 0; e < t.length; e += 1) {
                    let a = t[e].html,
                      r = n.get(a);
                    if (!r || 0 === r.length) continue;
                    let l = r.shift();
                    if (void 0 !== l && l !== e) return !0;
                  }
                  return !1;
                })(r, a);
                (m((e) => {
                  if (i) {
                    let e = new Map();
                    return (
                      a.forEach((t, n) => {
                        let a = N(t.html);
                        e.set(n, { baseHtml: a.html, elements: a.elements, previewHtml: a.html });
                      }),
                      e
                    );
                  }
                  let t = new Map(e);
                  for (let e of (a.forEach((e, n) => {
                    let a = t.get(n);
                    if (!a || a.baseHtml !== e.html) {
                      let r = N(e.html),
                        l = a
                          ? (function (e, t) {
                              let n = new Map(t.map((e) => [e.selector, e]));
                              return e.map((e) => {
                                let t = n.get(e.selector);
                                return t &&
                                  (t.currentValue !== t.originalValue ||
                                    t.userUploaded ||
                                    t.richHtml ||
                                    t.deleted ||
                                    t.fontFamily !== t.originalFontFamily ||
                                    t.fontSize !== t.originalFontSize ||
                                    t.color !== t.originalColor ||
                                    t.textAlign !== t.originalTextAlign ||
                                    t.fontWeight !== t.originalFontWeight ||
                                    t.lineHeight !== t.originalLineHeight ||
                                    t.letterSpacing !== t.originalLetterSpacing ||
                                    t.marginTop !== t.originalMarginTop ||
                                    t.marginBottom !== t.originalMarginBottom ||
                                    t.marginLeft !== t.originalMarginLeft ||
                                    t.marginRight !== t.originalMarginRight ||
                                    t.borderRadius !== t.originalBorderRadius ||
                                    t.opacity !== t.originalOpacity ||
                                    t.objectFit !== t.originalObjectFit ||
                                    t.backgroundPosition !== t.originalBackgroundPosition ||
                                    t.backgroundSize !== t.originalBackgroundSize ||
                                    t.translateX !== t.originalTranslateX ||
                                    t.translateY !== t.originalTranslateY ||
                                    t.width !== t.originalWidth ||
                                    t.height !== t.originalHeight ||
                                    t.rotate !== t.originalRotate)
                                  ? {
                                      ...e,
                                      currentValue: t.currentValue,
                                      userUploaded: t.userUploaded,
                                      richHtml: t.richHtml,
                                      deleted: t.deleted,
                                      fontFamily: t.fontFamily,
                                      fontSize: t.fontSize,
                                      color: t.color,
                                      textAlign: t.textAlign,
                                      fontWeight: t.fontWeight,
                                      lineHeight: t.lineHeight,
                                      letterSpacing: t.letterSpacing,
                                      marginTop: t.marginTop,
                                      marginBottom: t.marginBottom,
                                      marginLeft: t.marginLeft,
                                      marginRight: t.marginRight,
                                      borderRadius: t.borderRadius,
                                      opacity: t.opacity,
                                      objectFit: t.objectFit,
                                      backgroundPosition: t.backgroundPosition,
                                      backgroundSize: t.backgroundSize,
                                      translateX: t.translateX,
                                      translateY: t.translateY,
                                      width: t.width,
                                      height: t.height,
                                      rotate: t.rotate,
                                    }
                                  : e;
                              });
                            })(r.elements, a.elements)
                          : r.elements;
                      t.set(n, { baseHtml: r.html, elements: l, previewHtml: r.html });
                    }
                  }),
                  t.keys()))
                    e >= a.length && t.delete(e);
                  return t;
                }),
                  o >= a.length && a.length > 0 && (null == (n = B.current) || n.call(B, a.length - 1)));
              }, [a, o]),
              (0, r.useEffect)(() => {
                if (d || 0 === c.length) return;
                let e = c.find((e) => e.isDefault);
                e &&
                  m((t) => {
                    let n = !1,
                      a = new Map(t);
                    return (
                      a.forEach((t, r) => {
                        if (
                          t.elements.some(
                            (e) => "logo" === e.slotType && (!e.currentValue || e.currentValue === e.originalValue),
                          )
                        ) {
                          n = !0;
                          let l = t.elements.map((t) =>
                            "logo" !== t.slotType || (t.currentValue && t.currentValue !== t.originalValue)
                              ? t
                              : { ...t, currentValue: e.imageUrl },
                          );
                          a.set(r, { ...t, elements: l });
                        }
                      }),
                      n ? a : t
                    );
                  });
              }, [c, d]),
              {
                pageStates: g,
                setPageStates: m,
                currentState: $,
                currentPage: q,
                baseHtml: _,
                elements: G,
                previewHtml: J,
                canUndo: P,
                canRedo: U,
                undoCount: O,
                redoCount: V,
                undo: z,
                redo: M,
                setElements: K,
                setBaseHtml: Q,
                setPreviewHtml: Z,
                updateElement: ee,
                updateElementRichtext: et,
                clearRichText: en,
                deleteElement: ea,
                duplicateElement: er,
                updateElementStyle: el,
                addElement: ei,
                applyLogoToAllPages: es,
                applyFontToAllPages: eo,
                resetOnReopenRef: Y,
                flushPendingHistory: C,
                pushToHistory: A,
                _clampPageIndex: (0, r.useCallback)((e) => {
                  B.current = e;
                }, []),
              }
            );
          })({ pages: b, open: t, initialPageIndex: y, currentPageIndex: B, workspaceLogos: ec, isLoadingLogos: ed });
        (0, r.useEffect)(() => {
          eU($);
        }, [eU]);
        let [eO, eV] = (0, r.useState)(""),
          [eW, eX] = (0, r.useState)(!1),
          [eY, eB] = (0, r.useState)(null),
          [eq, e_] = (0, r.useState)(null),
          [eG, eJ] = (0, r.useState)({}),
          eK = (0, r.useRef)({}),
          e3 = (0, r.useCallback)(
            (e) => {
              var t, n;
              let a = ef.find((t) => t.id === e);
              if (!a || a.deleted || eW) return;
              let r = null != (n = null == (t = e2.current) ? void 0 : t.call(e2)) ? n : null;
              (r && r.id !== e && (r.isRich ? eA(r.id, r.value) : eC(r.id, r.value)),
                eT(e),
                eB((t) => (t === e ? null : t)),
                e_((t) => (t === e ? null : t)));
            },
            [eT, eC, eA, ef, eW],
          );
        (0, r.useEffect)(() => {
          eP.current && ((eP.current = !1), eB(null));
        });
        let e2 = (0, r.useRef)(null),
          e4 = (0, r.useRef)(null),
          e8 = (0, r.useRef)(eu);
        e8.current = eu;
        let e6 = (0, r.useCallback)((e, t) => "".concat(e, ":").concat(t), []),
          e7 = (0, r.useCallback)(
            (e, t) => {
              var n;
              let a = e8.current.get(t),
                r = null == a ? void 0 : a.elements.find((t) => t.id === e);
              return {
                prompt: null != (n = null == r ? void 0 : r.searchQuery) ? n : "",
                selectedRatio: w,
                referenceImageUrl: null,
                isUploadingRef: !1,
                numImages: 1,
                generating: !1,
                generatedImages: [],
              };
            },
            [w],
          ),
          e9 = (0, r.useCallback)(
            function (e, t) {
              let n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : q.current,
                a = e6(n, e);
              eJ((r) => {
                var l;
                let i = null != (l = r[a]) ? l : e7(e, n);
                return { ...r, [a]: t(i) };
              });
            },
            [e6, e7],
          ),
          te = (0, r.useCallback)(
            (e) => {
              var t;
              return null != (t = eG[e6(B, e)]) ? t : e7(e, B);
            },
            [eG, B, e6, e7],
          ),
          tt = (0, f.iL)(),
          { data: tn = [] } = (0, f.UL)({ enabled: eo }),
          {
            isUploading: ta,
            isRemovingBg: tr,
            selectedImageId: tl,
            editorImageSrc: ti,
            editorFileName: ts,
            searchingImageId: to,
            searchResults: tc,
            searchHasMore: td,
            loadingMoreImageId: tu,
            customSearchQuery: tg,
            isProxyUploading: tm,
            imageSource: tp,
            isUploadingAsset: th,
            setCustomSearchQuery: tf,
            setSearchResults: tx,
            setImageSource: tb,
            handleImageUpload: tv,
            handleFileChange: ty,
            handleOpenAdvancedEditor: tw,
            handleEditorSave: tj,
            handleEditorClose: tN,
            triggerFileInput: tE,
            handleUploadAsset: tk,
            handleDeleteAsset: tS,
            handleSelectAsset: tC,
            handleImageSearch: tA,
            handleLoadMoreImages: tR,
            handleSelectSearchedImage: tT,
            handleRemoveBackground: tz,
            fileInputRef: tH,
          } = (function (e) {
            let {
                elements: t,
                setElements: a,
                updateElement: l,
                t: i,
                sandboxMode: s,
                publicAIMode: o,
                apiPrefix: c,
                currentPageIndex: d,
                createWorkspaceLogo: u,
                createWorkspaceAsset: g,
                deleteWorkspaceAsset: m,
              } = e,
              [p, h] = (0, r.useState)(null),
              [f, b] = (0, r.useState)(null),
              [v, y] = (0, r.useState)(null),
              [w, j] = (0, r.useState)(null),
              [N, E] = (0, r.useState)(""),
              [k, S] = (0, r.useState)(null),
              [C, A] = (0, r.useState)({}),
              [R, T] = (0, r.useState)({}),
              [z, H] = (0, r.useState)({}),
              [F, M] = (0, r.useState)(null),
              [L, P] = (0, r.useState)({}),
              [I, D] = (0, r.useState)(null),
              [O, V] = (0, r.useState)("google"),
              [W, X] = (0, r.useState)(!1),
              Y = (0, r.useRef)({}),
              B = (0, r.useRef)(null),
              $ = (0, r.useCallback)((e) => "".concat(d, ":").concat(e), [d]),
              q = (0, r.useCallback)(
                (e) => {
                  let t = "".concat(d, ":");
                  return Object.fromEntries(
                    Object.entries(e)
                      .filter((e) => {
                        let [n] = e;
                        return n.startsWith(t);
                      })
                      .map((e) => {
                        let [n, a] = e;
                        return [n.slice(t.length), a];
                      }),
                  );
                },
                [d],
              ),
              _ = (0, r.useMemo)(() => q(C), [C, q]),
              G = (0, r.useMemo)(() => q(R), [R, q]),
              J = (0, r.useMemo)(() => q(L), [L, q]),
              K = (0, r.useCallback)(
                (e) => {
                  P((t) => {
                    let n = q(t),
                      a = "function" == typeof e ? e(n) : e,
                      r = { ...t },
                      l = "".concat(d, ":");
                    for (let e of Object.keys(r)) e.startsWith(l) && delete r[e];
                    for (let [e, t] of Object.entries(a)) r["".concat(l).concat(e)] = t;
                    return r;
                  });
                },
                [d, q],
              ),
              Q = (0, r.useCallback)(
                (e) => {
                  A((t) => {
                    let n = q(t),
                      a = "function" == typeof e ? e(n) : e,
                      r = { ...t },
                      l = "".concat(d, ":");
                    for (let e of Object.keys(r)) e.startsWith(l) && delete r[e];
                    for (let [e, t] of Object.entries(a)) r["".concat(l).concat(e)] = t;
                    return r;
                  });
                },
                [d, q],
              ),
              Z = (null == k ? void 0 : k.startsWith("".concat(d, ":"))) ? k.slice("".concat(d, ":").length) : null,
              ee = (null == F ? void 0 : F.startsWith("".concat(d, ":"))) ? F.slice("".concat(d, ":").length) : null,
              et = (null == I ? void 0 : I.startsWith("".concat(d, ":"))) ? I.slice("".concat(d, ":").length) : null,
              en = (0, r.useCallback)(
                async (e, n) => {
                  let r = t.find((t) => t.id === e),
                    l = (null == r ? void 0 : r.slotType) === "logo";
                  h(e);
                  try {
                    let t = await U.E.uploadFile(n);
                    if ((a((n) => n.map((n) => (n.id === e ? { ...n, currentValue: t, userUploaded: !0 } : n))), l)) {
                      let e = n.name.replace(/\.[^/.]+$/, "") || "Logo";
                      u.mutate(
                        { name: e, imageUrl: t },
                        {
                          onSuccess: () => {
                            (0, x.toast)({ title: i("pageEditor.logoSavedToWorkspace") });
                          },
                        },
                      );
                    } else (0, x.toast)({ title: i("pageEditor.imageUploaded") });
                  } catch (e) {
                    (console.error("Upload failed:", e),
                      (0, x.toast)({ title: i("pageEditor.uploadFailed"), variant: "destructive" }));
                  } finally {
                    h(null);
                  }
                },
                [a, i, t, u],
              ),
              ea = (0, r.useCallback)(
                async (e) => {
                  var t;
                  let n = null == (t = e.target.files) ? void 0 : t[0];
                  if (n && v)
                    if (s || o) {
                      let e = new FileReader();
                      ((e.onload = () => {
                        (j(e.result), E(n.name.replace(/\.[^/.]+$/, "")));
                      }),
                        e.readAsDataURL(n));
                    } else {
                      let e = await (0, er.H)(n);
                      h(v);
                      try {
                        let t = await U.E.uploadFile(e);
                        (j(t), E(n.name.replace(/\.[^/.]+$/, "")));
                      } catch (e) {
                        ((0, x.toast)({ title: i("pageEditor.uploadFailed"), variant: "destructive" }), y(null));
                      } finally {
                        h(null);
                      }
                    }
                  B.current && (B.current.value = "");
                },
                [v, s, o, i],
              ),
              el = (0, r.useCallback)(
                async (e) => {
                  let n = t.find((t) => t.id === e);
                  (null == n ? void 0 : n.currentValue) && (y(e), j(n.currentValue), E("edited-image.jpg"));
                },
                [t],
              ),
              ei = (0, r.useCallback)(
                async (e) => {
                  (v && (await en(v, e)),
                    (null == w ? void 0 : w.startsWith("blob:")) && URL.revokeObjectURL(w),
                    j(null),
                    E(""),
                    y(null));
                },
                [v, en, w],
              ),
              es = (0, r.useCallback)(() => {
                ((null == w ? void 0 : w.startsWith("blob:")) && URL.revokeObjectURL(w), j(null), E(""), y(null));
              }, [w]),
              eo = (0, r.useCallback)((e) => {
                var t;
                (y(e), null == (t = B.current) || t.click());
              }, []),
              ec = (0, r.useCallback)(
                async (e) => {
                  X(!0);
                  try {
                    let t = await U.E.uploadFile(e),
                      n = e.name.replace(/\.[^/.]+$/, "");
                    (await g.mutateAsync({ name: n, imageUrl: t }),
                      (0, x.toast)({ title: i("pageEditor.assetUploaded") }));
                  } catch (e) {
                    (console.error("Asset upload failed:", e),
                      (0, x.toast)({ title: i("pageEditor.assetUploadFailed"), variant: "destructive" }));
                  } finally {
                    X(!1);
                  }
                },
                [g, i],
              ),
              ed = (0, r.useCallback)(
                async (e) => {
                  try {
                    (await m.mutateAsync(e), (0, x.toast)({ title: i("pageEditor.assetDeleted") }));
                  } catch (e) {
                    (console.error("Asset delete failed:", e),
                      (0, x.toast)({ title: i("pageEditor.assetDeleteFailed"), variant: "destructive" }));
                  }
                },
                [m, i],
              ),
              eu = (0, r.useCallback)((e, t) => {
                (y(e), j(t), E("asset"));
              }, []),
              eg = (0, r.useCallback)(
                async (e, t, n) => {
                  let a = $(e),
                    r = n || O;
                  if (t.trim() && "custom" !== r) {
                    (S(a), P((e) => ({ ...e, [a]: t })));
                    try {
                      let e = await fetch("".concat(c, "/search-images"), {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ query: t, num: 10, source: r, page: 1 }),
                        }),
                        n = await e.json();
                      if (!n.success) throw Error(n.error);
                      (A((e) => ({ ...e, [a]: n.data.images })),
                        T((e) => {
                          var t;
                          return { ...e, [a]: null != (t = n.data.hasMore) && t };
                        }),
                        H((e) => {
                          var t;
                          return { ...e, [a]: null != (t = n.data.nextCursor) ? t : null };
                        }),
                        (Y.current = { ...Y.current, [a]: 1 }));
                    } catch (e) {
                      (console.error("Image search failed:", e),
                        (0, x.toast)({ title: i("pageEditor.searchFailed"), variant: "destructive" }));
                    } finally {
                      S(null);
                    }
                  }
                },
                [i, O, c, $],
              ),
              em = (0, r.useCallback)(
                async (e) => {
                  let t = $(e),
                    n = L[t];
                  if (!(null == n ? void 0 : n.trim()) || "custom" === O) return;
                  let a = (Y.current[t] || 1) + 1,
                    r = z[t];
                  M(t);
                  try {
                    let e = await fetch("".concat(c, "/search-images"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          query: n,
                          num: 10,
                          source: O,
                          page: a,
                          cursor: "pinterest" === O ? r : void 0,
                        }),
                      }),
                      l = await e.json();
                    if (!l.success) throw Error(l.error);
                    (A((e) => {
                      let n = e[t] || [],
                        a = new Set(n.map((e) => e.imageUrl)),
                        r = l.data.images.filter((e) => !a.has(e.imageUrl));
                      return { ...e, [t]: [...n, ...r] };
                    }),
                      T((e) => {
                        var n;
                        return { ...e, [t]: null != (n = l.data.hasMore) && n };
                      }),
                      H((e) => {
                        var n;
                        return { ...e, [t]: null != (n = l.data.nextCursor) ? n : null };
                      }),
                      (Y.current = { ...Y.current, [t]: a }));
                  } catch (e) {
                    (console.error("Load more images failed:", e),
                      (0, x.toast)({ title: i("pageEditor.searchFailed"), variant: "destructive" }));
                  } finally {
                    M(null);
                  }
                },
                [i, O, c, L, z, $],
              );
            return {
              isUploading: p,
              isRemovingBg: f,
              selectedImageId: v,
              editorImageSrc: w,
              editorFileName: N,
              searchingImageId: Z,
              searchResults: _,
              searchHasMore: G,
              loadingMoreImageId: ee,
              customSearchQuery: J,
              isProxyUploading: et,
              imageSource: O,
              isUploadingAsset: W,
              setCustomSearchQuery: K,
              setSearchResults: Q,
              setImageSource: V,
              handleImageUpload: en,
              handleFileChange: ea,
              handleOpenAdvancedEditor: el,
              handleEditorSave: ei,
              handleEditorClose: es,
              triggerFileInput: eo,
              handleUploadAsset: ec,
              handleDeleteAsset: ed,
              handleSelectAsset: eu,
              handleImageSearch: eg,
              handleLoadMoreImages: em,
              handleSelectSearchedImage: (0, r.useCallback)(
                async (e, t, a) => {
                  let r = $(e),
                    { isOwnStorageUrl: l } = await n.e(75881).then(n.bind(n, 75881));
                  if (l(t)) {
                    (y(e),
                      j(t),
                      E("search-result"),
                      A((e) => {
                        let { [r]: t, ...n } = e;
                        return n;
                      }));
                    return;
                  }
                  D(r);
                  let s = async (e) => {
                    try {
                      let t = await fetch("".concat(c, "/proxy-upload-image"), {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ imageUrl: e }),
                        }),
                        n = await t.json();
                      if (n.success) return n.data.url;
                      return null;
                    } catch (e) {
                      return null;
                    }
                  };
                  try {
                    let n = await s(t);
                    if (
                      (!n &&
                        a &&
                        a !== t &&
                        (console.log("[Image Select] imageUrl failed, trying thumbnailUrl as fallback"),
                        (n = await s(a))),
                      n)
                    )
                      (y(e),
                        j(n),
                        E("search-result"),
                        A((e) => {
                          let { [r]: t, ...n } = e;
                          return n;
                        }));
                    else throw Error("Both imageUrl and thumbnailUrl upload failed");
                  } catch (e) {
                    (console.error("Proxy upload failed:", e),
                      (0, x.toast)({ title: i("pageEditor.uploadFailed"), variant: "destructive" }));
                  } finally {
                    D(null);
                  }
                },
                [i, c, $],
              ),
              handleRemoveBackground: (0, r.useCallback)(
                async (e, t) => {
                  b(e);
                  try {
                    let n = await fetch("".concat(c, "/remove-background"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ imageUrl: t }),
                      }),
                      a = await n.json();
                    if (!a.success) throw Error(a.error);
                    (l(e, a.data.url), (0, x.toast)({ title: i("pageEditor.bgRemoved") }));
                  } catch (e) {
                    (console.error("Background removal failed:", e),
                      (0, x.toast)({ title: i("pageEditor.bgRemoveFailed"), variant: "destructive" }));
                  } finally {
                    b(null);
                  }
                },
                [l, i, c],
              ),
              fileInputRef: B,
            };
          })({
            elements: ef,
            setElements: eE,
            updateElement: eC,
            t: M,
            sandboxMode: C,
            publicAIMode: T,
            apiPrefix: Y,
            currentPageIndex: B,
            createWorkspaceLogo: tt,
            createWorkspaceAsset: (0, f.FV)(),
            deleteWorkspaceAsset: (0, f.FR)(),
          });
        (0, r.useEffect)(
          () => () => {
            (Object.values(eK.current).forEach((e) => {
              e.abort();
            }),
              (eK.current = {}));
          },
          [],
        );
        let tF = (0, r.useRef)(ef);
        ((tF.current = ef),
          (0, r.useEffect)(() => {
            if (e4.current !== B && tF.current.length > 0) {
              let e = tF.current.find((e) => "image" === e.type || "image-slot" === e.type);
              (e && eB(e.id), (e4.current = B));
            }
          }, [B]));
        let tM = (0, r.useCallback)(
            async (e, t) => {
              let n = e || eO;
              if (!n.trim()) return ex;
              eX(!0);
              try {
                let e = null,
                  i = A(ex),
                  s = (function (e) {
                    let t = [];
                    for (let n of e) {
                      let e =
                          "image" === n.type || "image-slot" === n.type
                            ? n.slotLabel || "image"
                            : n.currentValue.replace(/<[^>]*>/g, "").trim(),
                        a = e.length > 30 ? e.substring(0, 30) + "..." : e,
                        r = [];
                      if (n.deleted) {
                        t.push('- "'.concat(a, '": DELETED by user'));
                        continue;
                      }
                      let l =
                          !(z(n.translateX) && z(n.originalTranslateX)) &&
                          (n.translateX || "0px") !== (n.originalTranslateX || "0px"),
                        i =
                          !(z(n.translateY) && z(n.originalTranslateY)) &&
                          (n.translateY || "0px") !== (n.originalTranslateY || "0px");
                      ((l || i) &&
                        r.push(
                          "moved to translate(".concat(n.translateX || "0px", ", ").concat(n.translateY || "0px", ")"),
                        ),
                        n.width && n.width !== n.originalWidth && r.push("width changed to ".concat(n.width)),
                        n.height && n.height !== n.originalHeight && r.push("height changed to ".concat(n.height)),
                        (z(n.rotate) && z(n.originalRotate)) ||
                          (n.rotate || "0deg") === (n.originalRotate || "0deg") ||
                          r.push("rotated to ".concat(n.rotate)),
                        n.fontFamily &&
                          n.fontFamily !== n.originalFontFamily &&
                          r.push("font changed to ".concat(n.fontFamily)),
                        n.fontSize &&
                          n.fontSize !== n.originalFontSize &&
                          r.push("font size changed to ".concat(n.fontSize)),
                        n.color && n.color !== n.originalColor && r.push("color changed to ".concat(n.color)),
                        n.textAlign &&
                          n.textAlign !== n.originalTextAlign &&
                          r.push("text-align changed to ".concat(n.textAlign)),
                        n.fontWeight &&
                          n.fontWeight !== n.originalFontWeight &&
                          r.push("font-weight changed to ".concat(n.fontWeight)),
                        n.currentValue !== n.originalValue &&
                          ("image" === n.type || "image-slot" === n.type) &&
                          r.push("image replaced by user"),
                        n.currentValue !== n.originalValue &&
                          "text" === n.type &&
                          r.push("text content edited by user"),
                        r.length > 0 && t.push('- "'.concat(a, '" (').concat(n.type, "): ").concat(r.join(", "))));
                    }
                    return t.length > 0 ? t.join("\n") : null;
                  })(ef);
                if (T)
                  await V.E.refinePageStreamPublic(
                    { html: i, prompt: n, aspectRatio: w },
                    {
                      onPage: (t) => {
                        var n;
                        (null == (n = t.page) ? void 0 : n.html) && ((e = t.page.html), ek(t.page.html));
                      },
                      onError: (e) => {
                        throw Error(e.error);
                      },
                    },
                  );
                else {
                  var a, r, l;
                  let o;
                  if (k) o = null != (a = k(ex)) ? a : void 0;
                  else if (E) {
                    let e = null == (r = b[B]) ? void 0 : r.pageNumber;
                    o = e ? E.get(e) : void 0;
                  }
                  !o && S && (o = null != (l = await S(ex)) ? l : void 0);
                  let c = [];
                  (t && t.length > 0 && (c = await Promise.all(t.map((e) => U.E.uploadFile(e.file)))),
                    await V.E.refinePageStream(
                      {
                        html: i,
                        prompt: n,
                        aspectRatio: w,
                        ...(o && { imageUrl: o }),
                        ...(c.length > 0 && { attachedImageUrls: c }),
                        ...(s && { manualEdits: s }),
                      },
                      {
                        onPage: (t) => {
                          var n;
                          (null == (n = t.page) ? void 0 : n.html) && ((e = t.page.html), ek(t.page.html));
                        },
                        onError: (e) => {
                          if ("QUOTA_EXCEEDED" === e.type)
                            throw (
                              (0, x.toast)({
                                title: M("errors.aiQuotaInsufficient"),
                                description: M("errors.aiQuotaInsufficientDesc"),
                                variant: "destructive",
                              }),
                              Error("QUOTA_EXCEEDED")
                            );
                          throw Error(e.error);
                        },
                      },
                    ));
                }
                if (!e) throw Error("No refined HTML received");
                return (eV(""), (tP.current = !0), (0, x.toast)({ title: M("pageEditor.refined") }), e);
              } catch (e) {
                throw (
                  console.error("AI refinement failed:", e),
                  e instanceof Error &&
                    "QUOTA_EXCEEDED" !== e.message &&
                    (0, x.toast)({ title: M("pageEditor.refineFailed"), variant: "destructive" }),
                  e
                );
              } finally {
                eX(!1);
              }
            },
            [eO, ex, w, M, ek, eV, b, B, E, k, S, T, ef],
          ),
          tL = (0, r.useCallback)(
            (e) => {
              let t = e8.current;
              return b.map((n, a) => {
                let r = t.get(a);
                if (r) {
                  let t = r.elements;
                  e &&
                    a === q.current &&
                    (t = t.map((t) =>
                      t.id === e.id
                        ? e.isRich
                          ? { ...t, currentValue: e.value, richHtml: !0 }
                          : { ...t, currentValue: e.value, richHtml: !1 }
                        : t,
                    ));
                  let l = A(R(r.baseHtml, t)),
                    i = (0, W.Ci)(l);
                  return { ...n, html: i };
                }
                return n;
              });
            },
            [b],
          ),
          tP = (0, r.useRef)(!1);
        (0, r.useEffect)(() => {
          tP.current && ((tP.current = !1), j(tL()));
        }, [ex, tL, j]);
        let tI = (0, r.useCallback)(() => {
            var e, t;
            (j(tL(null != (t = null == (e = e2.current) ? void 0 : e.call(e2)) ? t : null)),
              (0, x.toast)({ title: M("pageEditor.saved") }));
          }, [tL, j, M]),
          tD = (0, r.useCallback)(() => {
            var e, t;
            (j(tL(null != (t = null == (e = e2.current) ? void 0 : e.call(e2)) ? t : null)), l(B));
          }, [tL, j, l, B]),
          tU = (0, r.useCallback)(
            (e) => {
              if (e >= 0 && e < b.length) {
                var t, n;
                let a = null != (n = null == (t = e2.current) ? void 0 : t.call(e2)) ? n : null;
                (a &&
                  eg((e) => {
                    let t = new Map(e),
                      n = t.get(B);
                    if (n) {
                      let e = n.elements.map((e) =>
                        e.id === a.id
                          ? a.isRich
                            ? { ...e, currentValue: a.value, richHtml: !0 }
                            : { ...e, currentValue: a.value, richHtml: !1 }
                          : e,
                      );
                      t.set(B, { ...n, elements: e });
                    }
                    return t;
                  }),
                  eI(),
                  eg((e) => {
                    let t = e.get(B);
                    if (t && t.previewHtml !== ex) {
                      let n = new Map(e);
                      return (n.set(B, { ...t, previewHtml: ex }), n);
                    }
                    return e;
                  }),
                  eB(null),
                  tf({}),
                  tx({}),
                  $(e));
              }
            },
            [b.length, B, eI, ex, eg, tf, tx],
          );
        !(function (e) {
          let t = !(arguments.length > 1) || void 0 === arguments[1] || arguments[1];
          (0, r.useEffect)(() => {
            if (!t) return;
            let n = (t) => {
              var n, a, r, l, i, s, o;
              let c = navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? t.metaKey : t.ctrlKey;
              if (c && "z" === t.key && !t.shiftKey) {
                (t.preventDefault(), null == (n = e.onUndo) || n.call(e));
                return;
              }
              if ((c && "z" === t.key && t.shiftKey) || (c && "y" === t.key)) {
                (t.preventDefault(), null == (a = e.onRedo) || a.call(e));
                return;
              }
              if (c && "s" === t.key) {
                (t.preventDefault(), null == (r = e.onSave) || r.call(e));
                return;
              }
              if ("Escape" === t.key) {
                null == (l = e.onEscape) || l.call(e);
                return;
              }
              let d = document.activeElement;
              if (!(d instanceof HTMLInputElement || d instanceof HTMLTextAreaElement)) {
                if ("ArrowLeft" === t.key) {
                  (t.preventDefault(), null == (i = e.onPrevPage) || i.call(e));
                  return;
                }
                if ("ArrowRight" === t.key) {
                  (t.preventDefault(), null == (s = e.onNextPage) || s.call(e));
                  return;
                }
                if ("Delete" === t.key || "Backspace" === t.key) {
                  null == (o = e.onDelete) || o.call(e);
                  return;
                }
              }
            };
            return (window.addEventListener("keydown", n), () => window.removeEventListener("keydown", n));
          }, [e, t]);
        })(
          {
            onUndo: () => {
              eb && (ej(), (0, x.toast)({ title: M("pageEditor.undone") }));
            },
            onRedo: () => {
              ev && (eN(), (0, x.toast)({ title: M("pageEditor.redone") }));
            },
            onSave: tI,
            onEscape: () => {
              eB(null);
            },
            onNextPage: () => tU(B + 1),
            onPrevPage: () => tU(B - 1),
          },
          t,
        );
        let [tO, tV] = (0, r.useState)("manual"),
          tW = (0, r.useCallback)(
            (e, t, n) => {
              eE((a) => a.map((a) => (a.id === e ? { ...a, translateX: t, translateY: n } : a)));
            },
            [eE],
          ),
          tX = (0, r.useCallback)(
            (e, t, n) => {
              eE((a) => a.map((a) => (a.id === e ? { ...a, width: t, height: n } : a)));
            },
            [eE],
          ),
          tY = (0, r.useCallback)(
            (e, t) => {
              eE((n) => n.map((n) => (n.id === e ? { ...n, rotate: t } : n)));
            },
            [eE],
          ),
          tB = (0, r.useCallback)(
            (e) => {
              e ? (tV("manual"), eB(e), _ && (K("manual"), es.snapTo("mid"))) : eB(null);
            },
            [_, es],
          ),
          t$ = (0, r.useCallback)(() => {
            eb && (ej(), (0, x.toast)({ title: M("pageEditor.undone") }));
          }, [eb, ej, M]),
          tq = (0, r.useCallback)(() => {
            ev && (eN(), (0, x.toast)({ title: M("pageEditor.redone") }));
          }, [ev, eN, M]),
          t_ = (0, r.useCallback)(
            async (e) => {
              var t;
              let n = q.current,
                a = e6(n, e),
                r = null != (t = eG[a]) ? t : e7(e, n),
                l = r.prompt.trim();
              if (!l) return;
              let i = eK.current[a];
              i && i.abort();
              let s = new AbortController();
              ((eK.current[a] = s), e9(e, (e) => ({ ...e, generating: !0, generatedImages: [] }), n));
              try {
                let t = await fetch("/api/v1/carousel-lab/generate-ai-image", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      prompt: l,
                      aspectRatio: r.selectedRatio,
                      referenceImageUrl: r.referenceImageUrl || void 0,
                      numImages: r.numImages,
                    }),
                    signal: s.signal,
                  }),
                  a = await t.json();
                if (s.signal.aborted) return;
                if (!t.ok) {
                  if (402 === t.status)
                    return void (0, x.toast)({
                      title: M("pageEditor.aiGenerateQuotaInsufficient", {
                        cost: O.X7.CAROUSEL_AI_IMAGE * r.numImages,
                      }),
                      variant: "destructive",
                    });
                  throw Error(a.message || a.error || "Generation failed");
                }
                e9(
                  e,
                  (e) => {
                    var t;
                    return {
                      ...e,
                      generatedImages: a.success && (null == (t = a.data) ? void 0 : t.images) ? a.data.images : [],
                    };
                  },
                  n,
                );
              } catch (e) {
                (e instanceof DOMException && "AbortError" === e.name) ||
                  (console.error("AI image generation failed:", e),
                  (0, x.toast)({ title: M("pageEditor.aiGenerateFailed"), variant: "destructive" }));
              } finally {
                (e9(e, (e) => ({ ...e, generating: !1 }), n), eK.current[a] === s && delete eK.current[a]);
              }
            },
            [eG, e6, e7, M, e9],
          ),
          tG = {
            elements: ef,
            openElementId: eY,
            setOpenElementId: eB,
            setHoveredElementId: e_,
            deleteElement: e3,
            duplicateElement: ez,
            showAI: P,
            onSwitchToAI: () => tV("ai"),
            isUploading: ta,
            isRemovingBg: tr,
            searchingImageId: to,
            searchResults: tc,
            customSearchQuery: tg,
            isProxyUploading: tm,
            imageSource: tp,
            onUpload: tE,
            onRemoveBg: tz,
            onSearch: tA,
            onLoadMore: tR,
            searchHasMore: td,
            loadingMoreImageId: tu,
            onSearchQueryChange: (e, t) => tf((n) => ({ ...n, [e]: t })),
            onSelectSearchedImage: tT,
            onClearSearchResults: (e) =>
              tx((t) => {
                let { [e]: n, ...a } = t;
                return a;
              }),
            onUpdateValue: eC,
            onUpdateStyle: eF,
            onImageSourceChange: tb,
            workspaceLogos: ec,
            onSelectLogo: (e, t) => eC(e, t),
            onApplyLogoToAllPages: eM,
            onApplyFontToAllPages: eL,
            onClearRichText: eR,
            totalPages: b.length,
            workspaceAssets: tn,
            onSelectAsset: tC,
            onUploadAsset: tk,
            onDeleteAsset: tS,
            isUploadingAsset: th,
            onOpenAdvancedEditor: tw,
            getAiImageGenerateState: te,
            onAiImagePromptChange: (e, t) => e9(e, (e) => ({ ...e, prompt: t })),
            onAiImageRatioChange: (e, t) => e9(e, (e) => ({ ...e, selectedRatio: t })),
            onAiImageReferenceImageUrlChange: (e, t) => e9(e, (e) => ({ ...e, referenceImageUrl: t })),
            onAiImageReferenceUploadStateChange: (e, t) => e9(e, (e) => ({ ...e, isUploadingRef: t })),
            onAiImageNumImagesChange: (e, t) => e9(e, (e) => ({ ...e, numImages: t })),
            onAiImageGenerate: t_,
            sandboxMode: !X,
            publicMode: T,
            addElement: eH,
            t: M,
          };
        eY && ef.find((e) => e.id === eY);
        let tJ = (0, a.jsxs)("div", {
            className: "flex flex-col h-full overflow-hidden",
            children: [
              (0, a.jsx)("div", {
                className: "flex-shrink-0 border-b bg-background",
                children: (0, a.jsxs)("div", {
                  className: "flex",
                  children: [
                    (0, a.jsxs)("button", {
                      onClick: () => tV("manual"),
                      className: (0, o.cn)(
                        "flex-1 px-4 py-3 text-sm font-medium transition-colors relative",
                        "manual" === tO
                          ? "text-foreground bg-muted/50"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                      ),
                      children: [
                        (0, a.jsxs)("div", {
                          className: "flex items-center justify-center gap-2",
                          children: [
                            (0, a.jsx)(m.A, { className: "h-4 w-4" }),
                            (0, a.jsx)("span", { children: M("pageEditor.edit") }),
                          ],
                        }),
                        "manual" === tO &&
                          (0, a.jsx)("div", { className: "absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" }),
                      ],
                    }),
                    P &&
                      (0, a.jsxs)("button", {
                        onClick: () => tV("ai"),
                        className: (0, o.cn)(
                          "flex-1 px-4 py-3 text-sm font-medium transition-colors relative",
                          "ai" === tO
                            ? "text-violet-600 bg-violet-500/5"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        ),
                        children: [
                          (0, a.jsxs)("div", {
                            className: "flex items-center justify-center gap-2",
                            children: [
                              (0, a.jsx)(g.A, { className: "h-4 w-4" }),
                              (0, a.jsx)("span", { children: M("aiChat.title") }),
                            ],
                          }),
                          "ai" === tO &&
                            (0, a.jsx)("div", { className: "absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600" }),
                        ],
                      }),
                  ],
                }),
              }),
              P &&
                "ai" === tO &&
                (0, a.jsx)("div", {
                  className: "flex-1 overflow-hidden min-h-0",
                  children: (0, a.jsx)(e1, {
                    onRefine: tM,
                    onUndo: ej,
                    onRedo: eN,
                    canUndo: eb,
                    canRedo: ev,
                    isRefining: eW,
                    currentHtml: ex,
                    aspectRatio: w,
                    renderPageToImage: S,
                    onSwitchToManual: () => tV("manual"),
                    className: "h-full",
                  }),
                }),
              "manual" === tO && (0, a.jsx)(e$, { ...tG, scrollable: !0 }),
            ],
          }),
          tK = (0, a.jsxs)("div", {
            className: "flex flex-col h-full overflow-hidden bg-muted/30",
            children: [
              (0, a.jsx)("div", {
                className: "flex-1 min-h-0 overflow-y-scroll overflow-x-hidden p-4 scrollbar-thin",
                children: (0, a.jsx)("div", {
                  className: "w-full mx-auto",
                  children: (0, a.jsx)(Q, {
                    html: ex,
                    aspectRatio: w,
                    selectedElementId: eY,
                    hoveredElementId: eq,
                    elements: ef,
                    onElementClick: tB,
                    onElementTextUpdate: eC,
                    onElementRichtextUpdate: eA,
                    onElementMove: tW,
                    onElementResize: tX,
                    onElementRotate: tY,
                    onElementDelete: e3,
                    isRefining: eW,
                    flushRef: e2,
                  }),
                }),
              }),
              (0, a.jsx)(e0, { html: ex, label: "Preview HTML" }),
            ],
          }),
          tQ = (null == ep ? void 0 : ep.pageNumber) || B + 1,
          tZ = (0, a.jsx)("input", {
            ref: tH,
            type: "file",
            accept: "image/png,image/jpeg,image/webp",
            className: "hidden",
            onChange: ty,
          });
        if (_) {
          let e = (e) => {
              J === e
                ? (K("none"), es.snapTo("collapsed"))
                : (K(e), "collapsed" === es.currentSnap && es.snapTo("mid"));
            },
            n = (0, a.jsx)(d.cj, {
              open: t,
              onOpenChange: (e) => !e && tD(),
              children: (0, a.jsxs)(d.h, {
                side: "bottom",
                className: "h-[95vh] p-0 flex flex-col",
                zIndex: 1e4,
                onInteractOutside: (e) => e.preventDefault(),
                onPointerDownOutside: (e) => e.preventDefault(),
                children: [
                  (0, a.jsx)(d.Fm, {
                    className: "sr-only",
                    children: (0, a.jsx)(d.qp, { children: M("pageEditor.title", { pageNumber: tQ }) }),
                  }),
                  (0, a.jsx)(eZ, {
                    currentPageIndex: B,
                    totalPages: b.length,
                    onNavigate: tU,
                    canUndo: eb,
                    canRedo: ev,
                    onUndo: t$,
                    onRedo: tq,
                    pageNumber: tQ,
                    onSaveAndClose: tD,
                    t: M,
                  }),
                  (0, a.jsx)(Z.N, {
                    children:
                      el &&
                      (0, a.jsx)(ee.P.div, {
                        initial: { height: "auto", opacity: 1 },
                        exit: { height: 0, opacity: 0 },
                        transition: { duration: 0.3 },
                        className: "overflow-hidden flex-shrink-0",
                        children: (0, a.jsxs)("div", {
                          className: "flex items-center justify-center gap-1.5 bg-amber-500/10 px-3 py-1",
                          children: [
                            (0, a.jsx)(p.A, { className: "h-3 w-3 shrink-0 text-amber-500" }),
                            (0, a.jsx)("p", {
                              className: "text-[11px] font-medium text-amber-700 dark:text-amber-400",
                              children: M("pageEditor.doNotLeave"),
                            }),
                          ],
                        }),
                      }),
                  }),
                  (0, a.jsx)("div", {
                    className: "flex-1 min-h-0 overflow-auto",
                    children: (0, a.jsx)("div", {
                      className: "h-full p-3 bg-muted/30",
                      children: (0, a.jsx)(Q, {
                        html: ex,
                        aspectRatio: w,
                        selectedElementId: eY,
                        hoveredElementId: eq,
                        elements: ef,
                        onElementClick: tB,
                        onElementTextUpdate: eC,
                        onElementRichtextUpdate: eA,
                        onElementMove: tW,
                        onElementResize: tX,
                        onElementRotate: tY,
                        onElementDelete: e3,
                        isRefining: eW,
                        flushRef: e2,
                      }),
                    }),
                  }),
                  (0, a.jsxs)(ee.P.div, {
                    className:
                      "flex-shrink-0 bg-background border-t rounded-t-xl shadow-[0_-4px_12px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden",
                    initial: { height: es.initialHeight },
                    animate: es.controls,
                    children: [
                      (0, a.jsx)("div", {
                        className:
                          "flex-shrink-0 flex items-center justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none select-none",
                        onPointerDown: es.onPointerDown,
                        "aria-label": M("pageEditor.dragToResize"),
                        children: (0, a.jsx)("div", { className: "w-10 h-1 rounded-full bg-muted-foreground/30" }),
                      }),
                      (0, a.jsx)("div", {
                        className: "flex-shrink-0 px-2 pb-2",
                        children: (0, a.jsxs)("div", {
                          className: "flex gap-2",
                          children: [
                            (0, a.jsxs)(u.$, {
                              variant: "manual" === J ? "default" : "outline",
                              size: "sm",
                              onClick: () => e("manual"),
                              className: "flex-1 h-9",
                              children: [(0, a.jsx)(m.A, { className: "h-4 w-4 mr-1.5" }), M("pageEditor.edit")],
                            }),
                            P &&
                              (0, a.jsxs)(u.$, {
                                variant: "ai" === J ? "default" : "outline",
                                size: "sm",
                                onClick: () => e("ai"),
                                className: "flex-1 h-9",
                                children: [(0, a.jsx)(g.A, { className: "h-4 w-4 mr-1.5" }), "AI"],
                              }),
                            (0, a.jsxs)(u.$, {
                              size: "sm",
                              onClick: tD,
                              className: "flex-1 h-9 bg-primary text-primary-foreground font-semibold shadow-md",
                              children: [(0, a.jsx)(h.A, { className: "h-4 w-4 mr-1.5" }), M("pageEditor.save")],
                            }),
                          ],
                        }),
                      }),
                      (0, a.jsxs)("div", {
                        className: "flex-1 min-h-0 overflow-y-auto",
                        children: [
                          P &&
                            "ai" === J &&
                            (0, a.jsx)(e1, {
                              onRefine: tM,
                              onUndo: ej,
                              onRedo: eN,
                              canUndo: eb,
                              canRedo: ev,
                              isRefining: eW,
                              currentHtml: ex,
                              aspectRatio: w,
                              renderPageToImage: S,
                              onSwitchToManual: () => K("manual"),
                              className: "h-full",
                            }),
                          "manual" === J &&
                            (0, a.jsx)(e$, { ...tG, compact: !0, scrollable: !1, onExpand: () => es.snapTo("mid") }),
                        ],
                      }),
                    ],
                  }),
                  tZ,
                ],
              }),
            }),
            r = (0, a.jsxs)(a.Fragment, {
              children: [
                n,
                ti && (0, a.jsx)(e5, { open: !!ti, onClose: tN, imageSrc: ti, onSave: tj, originalFileName: ts }),
              ],
            });
          return "undefined" != typeof document ? (0, i.createPortal)(r, document.body) : r;
        }
        let t0 = "16:9" === w;
        return (0, a.jsxs)(a.Fragment, {
          children: [
            (0, a.jsx)(c.lG, {
              open: t,
              onOpenChange: (e) => !e && tD(),
              children: (0, a.jsxs)(c.Cf, {
                className: (0, o.cn)("p-0 flex flex-col", t0 ? "max-w-[95vw] h-[90vh]" : "max-w-7xl h-[85vh]"),
                zIndex: 1e4,
                children: [
                  (0, a.jsx)(eQ, {
                    currentPageIndex: B,
                    totalPages: b.length,
                    onNavigate: tU,
                    canUndo: eb,
                    canRedo: ev,
                    onUndo: t$,
                    onRedo: tq,
                    undoCount: ey,
                    redoCount: ew,
                    pageNumber: tQ,
                    onSave: tI,
                    onSaveAndClose: tD,
                    t: M,
                  }),
                  (0, a.jsxs)("div", {
                    className: "flex items-center justify-center gap-2 border-b bg-amber-500/10 px-4 py-1.5",
                    children: [
                      (0, a.jsx)(p.A, { className: "h-3.5 w-3.5 shrink-0 text-amber-500" }),
                      (0, a.jsx)("p", {
                        className: "text-xs font-medium text-amber-700 dark:text-amber-400",
                        children: M("pageEditor.doNotLeave"),
                      }),
                    ],
                  }),
                  (0, a.jsxs)("div", {
                    className: "flex flex-row flex-1 overflow-hidden min-h-0",
                    children: [
                      (0, a.jsx)("div", {
                        className: (0, o.cn)("flex flex-col overflow-hidden", "w-[55%]"),
                        children: tK,
                      }),
                      (0, a.jsx)("div", {
                        className: (0, o.cn)("border-l flex flex-col overflow-hidden", "w-[45%]"),
                        children: tJ,
                      }),
                    ],
                  }),
                  tZ,
                ],
              }),
            }),
            ti && (0, a.jsx)(e5, { open: !!ti, onClose: tN, imageSrc: ti, onSave: tj, originalFileName: ts }),
          ],
        });
      }
    },
  },
]);
