(function () {
  'use strict';

  async function renderQrCodes() {
    var canvases = document.querySelectorAll('canvas[data-qrcode-url]');
    if (!canvases.length) return;
    try {
      var module = await import('/admin/vendor/sveltia-cms-0.261.0/npm/chunks/qrcode-B7o-SadT.js');
      for (var canvas of canvases) {
        if (canvas.dataset.ready === 'true') continue;
        await module.toCanvas(canvas, canvas.dataset.qrcodeUrl, {
          width: 360,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#17242f', light: '#ffffff' }
        });
        canvas.dataset.ready = 'true';
      }
    } catch (error) {
      document.querySelectorAll('.wx-qrcode').forEach(function (container) {
        container.textContent = '二维码暂时无法生成，请复制当前文章链接分享。';
        container.className = 'wx-qrcode wx-qrcode-error';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderQrCodes, { once: true });
  } else {
    renderQrCodes();
  }
})();
