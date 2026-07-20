/**
 * Chronos Toolbox — CurvedInput Component
 * A curved input field with optional button and icon.
 * Vanilla JS implementation of the React Bits CurvedInput component.
 */

'use strict';

const CurvedInput = (() => {
  const DEG = 180 / Math.PI;
  const round2 = n => Math.round(n * 100) / 100;

  const hexToRgba = (hex, alpha) => {
    let h = String(hex).replace('#', '');
    if (h.length === 3)
      h = h.split('').map(c => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n)) return hex;
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  };

  const SHADOWS = { sm: [5, 12, 0.3], md: [10, 24, 0.4], lg: [16, 40, 0.52] };

  const THEMES = {
    dark: {
      backgroundColor: '#1B1722',
      textColor: '#f5f5f5',
      placeholderColor: '#a1a1aa',
      borderColor: '#392e4e',
      buttonColor: '#A855F7',
      buttonTextColor: '#ffffff',
      shadowColor: '#000000'
    },
    light: {
      backgroundColor: '#ffffff',
      textColor: '#1d2050',
      placeholderColor: '#9aa0b6',
      borderColor: '#262a56',
      buttonColor: '#4763eb',
      buttonTextColor: '#ffffff',
      shadowColor: '#0b0e2a'
    }
  };

  const buildGeometry = (width, bend, thickness, pad) => {
    const W = width;
    const T = thickness;
    const s = Math.max(-W * 0.35, Math.min(bend, W * 0.35));
    const a = Math.abs(s);
    const dir = s >= 0 ? 1 : -1;
    const svgH = T + a + pad * 2;

    if (a < 0.75) {
      const midY = pad + T / 2;
      return {
        straight: true, W, T, svgH, uPerLen: 1,
        point: (u, v) => [u, midY + v],
        angleAt: () => 0,
        uFromPoint: x => x
      };
    }

    const R = (W * W * 0.25 + a * a) / (2 * a);
    const cx = W / 2;
    const apexY = pad + T / 2 + (dir > 0 ? 0 : a);
    const cy = apexY + dir * R;
    const phi = Math.asin(Math.min(1, W / (2 * R)));

    return {
      straight: false, W, T, svgH, R, dir, uPerLen: W / (2 * R * phi),
      point: (u, v) => {
        const th = ((u - cx) / cx) * phi;
        const rho = R - dir * v;
        return [cx + rho * Math.sin(th), cy - dir * rho * Math.cos(th)];
      },
      angleAt: u => dir * ((u - cx) / cx) * phi * DEG,
      uFromPoint: (x, y) => {
        const th = Math.atan2(x - cx, dir * (cy - y));
        return cx + (th / phi) * cx;
      }
    };
  };

  const fmt = (g, u, v) => {
    const [x, y] = g.point(u, v);
    return `${round2(x)} ${round2(y)}`;
  };

  const edgeSeg = (g, uTo, v, ltr) => {
    if (g.straight) return `L ${fmt(g, uTo, v)}`;
    const rho = round2(g.R - g.dir * v);
    const sweep = ltr === g.dir > 0 ? 1 : 0;
    return `A ${rho} ${rho} 0 0 ${sweep} ${fmt(g, uTo, v)}`;
  };

  const bentRectPath = (g, u0, u1, vTop, vBot, radius) => {
    const rc = Math.max(0, Math.min(radius, (vBot - vTop) / 2, (u1 - u0) / 2));
    return [
      `M ${fmt(g, u0 + rc, vTop)}`,
      edgeSeg(g, u1 - rc, vTop, true),
      `Q ${fmt(g, u1, vTop)} ${fmt(g, u1, vTop + rc)}`,
      `L ${fmt(g, u1, vBot - rc)}`,
      `Q ${fmt(g, u1, vBot)} ${fmt(g, u1 - rc, vBot)}`,
      edgeSeg(g, u0 + rc, vBot, false),
      `Q ${fmt(g, u0, vBot)} ${fmt(g, u0, vBot - rc)}`,
      `L ${fmt(g, u0, vTop + rc)}`,
      `Q ${fmt(g, u0, vTop)} ${fmt(g, u0 + rc, vTop)}`,
      'Z'
    ].join(' ');
  };

  const bentLinePath = (g, u0, u1, v) => `M ${fmt(g, u0, v)} ${edgeSeg(g, u1, v, true)}`;

  const SELECTABLE_TYPES = ['text', 'search', 'tel', 'url', 'password'];

  class CurvedInputComponent {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this.container) throw new Error('CurvedInput: Container not found');

      this.options = {
        value: undefined,
        defaultValue: '',
        onChange: null,
        onSubmit: null,
        placeholder: 'Enter your email',
        buttonText: 'Get Started',
        type: 'email',
        name: undefined,
        ariaLabel: undefined,
        theme: 'dark',
        width: 450,
        bend: 28,
        height: 64,
        cornerRadius: 18,
        borderWidth: 1.5,
        fontSize: 16,
        backgroundColor: undefined,
        textColor: undefined,
        placeholderColor: undefined,
        borderColor: undefined,
        buttonColor: undefined,
        buttonTextColor: undefined,
        iconColor: undefined,
        shadowSize: 'md',
        shadowColor: undefined,
        showButton: true,
        showIcon: true,
        icon: undefined,
        className: '',
        style: undefined,
        ...options
      };

      this.uid = 'ci-' + Math.random().toString(36).substr(2, 9);
      this.layoutPathId = `ci-text-${this.uid}`;
      this.buttonPathId = `ci-btn-${this.uid}`;
      this.clipId = `ci-clip-${this.uid}`;

      this.innerValue = this.options.defaultValue;
      this.caretIndex = this.options.defaultValue.length;
      this.focused = false;
      this.caretU = 0;
      this.scrollLen = 0;
      this.scrollRef = 0;
      this.btnTextW = 0;
      this.w = 0;

      this.init();
    }

    init() {
      this.measureButtonText();
      this.render();
      this.bindEvents();
      this.updateWidth();
    }

    measureButtonText() {
      const opts = this.options;
      if (!opts.showButton) return;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = `600 ${opts.fontSize}px ${getComputedStyle(document.body).fontFamily || 'Outfit, sans-serif'}`;
      this.btnTextW = ctx.measureText(opts.buttonText).width;
    }

    render() {
      const opts = this.options;
      const palette = THEMES[opts.theme] || THEMES.dark;

      this.form = document.createElement('form');
      this.form.className = `curved-input ${opts.className}`.trim();
      this.form.style.width = typeof opts.width === 'number' ? `${opts.width}px` : opts.width;
      if (opts.style) Object.assign(this.form.style, opts.style);
      this.form.noValidate = true;

      this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.svg.setAttribute('class', 'curved-input__svg');
      this.svg.setAttribute('width', opts.width);
      this.svg.setAttribute('height', opts.height);
      this.svg.setAttribute('viewBox', `0 0 ${opts.width} ${opts.height}`);

      this.input = document.createElement('input');
      this.input.className = 'curved-input__field';
      this.input.type = SELECTABLE_TYPES.includes(opts.type) ? opts.type : 'text';
      this.input.value = this.getValue();
      this.input.setAttribute('aria-label', opts.ariaLabel || opts.placeholder || 'Curved input');
      this.input.autocomplete = 'off';
      this.input.autocapitalize = 'none';
      this.input.autocorrect = 'off';
      this.input.spellcheck = false;
      if (opts.name) this.input.name = opts.name;

      this.form.appendChild(this.svg);
      this.form.appendChild(this.input);
      this.container.appendChild(this.form);

      this.updateSVG();
    }

    getValue() {
      return this.options.value !== undefined ? this.options.value : this.innerValue;
    }

    getDisplay() {
      const val = this.getValue();
      return this.options.type === 'password' ? '•'.repeat(val.length) : val;
    }

    updateWidth() {
      if (!this.form) return;
      const ro = new ResizeObserver(entries => {
        const cw = entries[0]?.contentRect?.width ?? this.form.clientWidth;
        const newW = Math.round(cw);
        if (newW !== this.w) {
          this.w = newW;
          this.updateSVG();
        }
      });
      ro.observe(this.form);
    }

    updateSVG() {
      const opts = this.options;
      const palette = THEMES[opts.theme] || THEMES.dark;
      const bgColor = opts.backgroundColor ?? palette.backgroundColor;
      const fgColor = opts.textColor ?? palette.textColor;
      const phColor = opts.placeholderColor ?? palette.placeholderColor;
      const strokeColor = opts.borderColor ?? palette.borderColor;
      const accentColor = opts.buttonColor ?? palette.buttonColor;
      const btnFgColor = opts.buttonTextColor ?? palette.buttonTextColor;
      const shColor = opts.shadowColor ?? palette.shadowColor;

      const actualW = this.w || opts.width;
      const pad = Math.ceil(opts.borderWidth / 2) + 6;
      const geom = buildGeometry(actualW, opts.bend, opts.height, pad);
      
      const T = opts.height;
      const vBase = opts.fontSize * 0.34;
      const chipH = Math.min(34, Math.max(16, T * 0.34));
      const chipW = chipH * 1.25;
      const iconU = 22 + chipW / 2;
      const textStartU = opts.showIcon ? 22 + chipW + 13 : 24;
      const btnInset = Math.max(5, opts.borderWidth + 4);
      const btnW = opts.showButton ? Math.max(this.btnTextW + opts.fontSize * 2.7, T * 1.35) : 0;
      const btnU1 = geom.W - btnInset;
      const btnU0 = btnU1 - btnW;
      const textEndU = Math.max(textStartU + 20, opts.showButton ? btnU0 - 14 : geom.W - 24);
      const winLen = (textEndU - textStartU) / geom.uPerLen;

      const display = this.getDisplay();
      const scrollU = this.scrollRef * geom.uPerLen;
      const bandPath = bentRectPath(geom, 0, geom.W, -T / 2, T / 2, opts.cornerRadius);
      const layoutPath = bentLinePath(geom, textStartU - scrollU, geom.W, vBase);
      const clipPath = bentRectPath(geom, textStartU - 6, textEndU + 8, -T / 2, T / 2, 0);

      const shadow = SHADOWS[opts.shadowSize];
      const svgStyle = shadow
        ? `filter: drop-shadow(0 ${shadow[0]}px ${shadow[1]}px ${hexToRgba(shColor, shadow[2])})`
        : '';

      // Update SVG viewBox to match actual width
      this.svg.setAttribute('width', actualW);
      this.svg.setAttribute('viewBox', `0 0 ${actualW} ${opts.height}`);

      let svgContent = `
        <defs>
          <clipPath id="${this.clipId}">
            <path d="${clipPath}" />
          </clipPath>
        </defs>

        <path class="curved-input__ring" d="${bandPath}" fill="none" stroke="${accentColor}" stroke-width="${opts.borderWidth + 6}" />
        <path d="${bandPath}" fill="${bgColor}" stroke="${strokeColor}" stroke-width="${opts.borderWidth}" />

        <path id="${this.layoutPathId}" d="${layoutPath}" fill="none" />
      `;

      if (opts.showIcon) {
        const chipFill = opts.iconColor || accentColor;
        const ew = chipW * 0.5;
        const eh = chipH * 0.5;
        const sw = Math.max(1.1, chipH * 0.075);
        const [ix, iy] = geom.point(iconU, 0);
        const iconAngle = geom.angleAt(iconU);

        svgContent += `
          <g transform="translate(${round2(ix)} ${round2(iy)}) rotate(${round2(iconAngle)})" aria-hidden="true">
            ${opts.icon || `
              <rect x="${-chipW / 2}" y="${-chipH / 2}" width="${chipW}" height="${chipH}" rx="${chipH * 0.27}" fill="${chipFill}" />
              <rect x="${-ew / 2}" y="${-eh / 2}" width="${ew}" height="${eh}" rx="1.4" fill="none" stroke="#ffffff" stroke-width="${sw}" stroke-linejoin="round" />
              <path d="M ${round2(-ew / 2)} ${round2(-eh / 2 + sw * 0.4)} L 0 ${round2(eh * 0.14)} L ${round2(ew / 2)} ${round2(-eh / 2 + sw * 0.4)}" fill="none" stroke="#ffffff" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" />
            `}
          </g>
        `;
      }

      svgContent += `
        <g clip-path="url(#${this.clipId})">
          <text style="font-size: ${opts.fontSize}px; font-weight: 500;" fill="${fgColor}" xmlspace="preserve" aria-hidden="true">
            <textPath href="#${this.layoutPathId}">${display}</textPath>
          </text>
          ${!display && opts.placeholder ? `
            <text style="font-size: ${opts.fontSize}px; font-weight: 500;" fill="${phColor}" xmlspace="preserve" aria-hidden="true">
              <textPath href="#${this.layoutPathId}">${opts.placeholder}</textPath>
            </text>
          ` : ''}
          ${this.focused ? this.renderCaret(geom, T, fgColor, opts.fontSize) : ''}
        </g>
      `;

      if (opts.showButton) {
        const btnH = T - btnInset * 2;
        const buttonPath = bentRectPath(geom, btnU0, btnU1, -T / 2 + btnInset, T / 2 - btnInset, Math.min(opts.cornerRadius * 0.72, btnH / 2));
        const iconCx = (btnU0 + btnU1) / 2;
        const iconCy = 0;
        const iconR = Math.min(btnH * 0.28, 10);
        const iconStroke = Math.max(2, iconR * 0.22);
        const [iconX, iconY] = geom.point(iconCx, iconCy);
        const iconAngle = geom.angleAt(iconCx);

        svgContent += `
          <g class="curved-input__button" role="button" tabindex="0" aria-label="${opts.buttonText}">
            <path class="curved-input__button-bg" d="${buttonPath}" fill="${accentColor}" />
            <g transform="translate(${round2(iconX)} ${round2(iconY)}) rotate(${round2(iconAngle)})">
              <circle cx="0" cy="${-iconR * 0.1}" r="${iconR}" fill="none" stroke="${btnFgColor}" stroke-width="${iconStroke}" />
              <line x1="${iconR * 0.6}" y1="${iconR * 0.5}" x2="${iconR * 1.1}" y2="${iconR * 1.0}" stroke="${btnFgColor}" stroke-width="${iconStroke}" stroke-linecap="round" />
            </g>
          </g>
        `;
      }

      this.svg.innerHTML = svgContent;
      this.svg.style.cssText = svgStyle;
    }

    renderCaret(geom, T, fgColor, fontSize) {
      const val = this.getValue();
      const caret = Math.min(this.caretIndex, val.length);
      const display = this.getDisplay();
      
      // Approximate caret position
      const textStartU = this.options.showIcon ? 22 + Math.min(34, Math.max(16, T * 0.34)) * 1.25 + 13 : 24;
      const charWidth = fontSize * 0.6; // Approximate
      const caretLen = caret * charWidth;
      const scrollU = this.scrollRef * geom.uPerLen;
      const caretU = textStartU + (caretLen - scrollU) * geom.uPerLen;
      
      const [caretX, caretY] = geom.point(caretU, 0);
      const caretAngle = geom.angleAt(caretU);
      const caretH = Math.min(T * 0.58, fontSize * 1.45);

      return `
        <g transform="translate(${round2(caretX)} ${round2(caretY)}) rotate(${round2(caretAngle)})">
          <line y1="${-caretH / 2}" y2="${caretH / 2}" stroke="${fgColor}" stroke-width="1.5" stroke-linecap="round">
            <animate attributeName="opacity" values="1;0" dur="1.06s" calcMode="discrete" repeatCount="indefinite" />
          </line>
        </g>
      `;
    }

    bindEvents() {
      this.input.addEventListener('input', (e) => {
        this.innerValue = e.target.value;
        this.caretIndex = e.target.selectionStart ?? e.target.value.length;
        this.options.onChange?.(this.getValue());
        this.updateSVG();
      });

      this.input.addEventListener('select', (e) => {
        this.caretIndex = e.target.selectionStart ?? e.target.value.length;
        this.updateSVG();
      });

      this.input.addEventListener('keyup', (e) => {
        this.caretIndex = e.target.selectionStart ?? e.target.value.length;
        this.updateSVG();
      });

      this.input.addEventListener('focus', () => {
        this.focused = true;
        this.form.classList.add('curved-input--focused');
        this.updateSVG();
      });

      this.input.addEventListener('blur', () => {
        this.focused = false;
        this.form.classList.remove('curved-input--focused');
        this.updateSVG();
      });

      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.options.onSubmit?.(this.getValue());
      });

      this.svg.addEventListener('click', (e) => {
        this.input.focus();
        // Approximate caret position from click
        const rect = this.svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const charWidth = this.options.fontSize * 0.6;
        const idx = Math.round(x / charWidth);
        const clampedIdx = Math.max(0, Math.min(idx, this.getValue().length));
        this.input.setSelectionRange(clampedIdx, clampedIdx);
        this.caretIndex = clampedIdx;
        this.updateSVG();
      });

      // Button click via delegation (survives SVG re-renders)
      this.svg.addEventListener('click', (e) => {
        const btn = e.target.closest('.curved-input__button');
        if (btn) {
          e.stopPropagation();
          this.options.onSubmit?.(this.getValue());
        }
      });
    }

    setValue(value) {
      this.innerValue = value;
      this.input.value = value;
      this.caretIndex = value.length;
      this.updateSVG();
    }

    destroy() {
      this.form?.remove();
    }
  }

  return CurvedInputComponent;
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CurvedInput;
}
