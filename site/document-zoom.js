(() => {
  'use strict';
  window.AXDDocumentZoom = ({ viewport, canvas, onZoom, enabled = () => true, maxZoom = () => 4 }) => {
    let scale = 1, touch, gesture, drag;
    const point = (x, y) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (x - rect.left) / Math.max(1, rect.width), y: (y - rect.top) / Math.max(1, rect.height) };
    };
    const center = () => {
      const rect = viewport.getBoundingClientRect();
      return { x: rect.left + viewport.clientWidth / 2, y: rect.top + viewport.clientHeight / 2 };
    };
    function zoom(value, x = center().x, y = center().y, anchor = point(x, y)) {
      if (!enabled()) return;
      scale = Math.max(1, Math.min(maxZoom(), value));
      onZoom(scale);
      viewport.dataset.zoomed = String(scale > 1.01);
      // Preserve the point under the pointer, including when centered pages
      // become wider than the viewport. Page gaps scale with the document.
      const rect = canvas.getBoundingClientRect();
      viewport.scrollLeft += rect.left + anchor.x * rect.width - x;
      viewport.scrollTop += rect.top + anchor.y * rect.height - y;
    }
    viewport.addEventListener('wheel', event => {
      if (!enabled() || (!event.ctrlKey && !event.metaKey)) return;
      event.preventDefault();
      event.stopPropagation();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      zoom(scale * Math.exp(-pixels * .008), event.clientX, event.clientY);
    }, { passive: false });
    viewport.addEventListener('dblclick', event => {
      if (!enabled() || event.button !== 0) return;
      event.preventDefault();
      zoom(scale > 1.01 ? 1 : 2, event.clientX, event.clientY);
    });
    viewport.addEventListener('keydown', event => {
      if (!enabled() || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!['+', '=', '-', '0'].includes(event.key)) return;
      event.preventDefault();
      zoom(event.key === '0' ? 1 : scale * (event.key === '-' ? 1 / 1.25 : 1.25));
    });
    const fingers = touches => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
      distance: Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY),
    });
    viewport.addEventListener('touchstart', event => {
      if (!enabled() || event.touches.length !== 2) return;
      event.preventDefault();
      const middle = fingers(event.touches);
      touch = { ...middle, scale, anchor: point(middle.x, middle.y) };
    }, { passive: false });
    viewport.addEventListener('touchmove', event => {
      if (!touch || event.touches.length !== 2) return;
      event.preventDefault();
      const middle = fingers(event.touches);
      zoom(touch.scale * middle.distance / Math.max(1, touch.distance), middle.x, middle.y, touch.anchor);
    }, { passive: false });
    const endTouch = event => { if (event.touches.length < 2) touch = null; };
    viewport.addEventListener('touchend', endTouch);
    viewport.addEventListener('touchcancel', () => { touch = null; });
    // Safari trackpads expose gesture events instead of Control-wheel.
    viewport.addEventListener('gesturestart', event => {
      if (!enabled()) return;
      event.preventDefault();
      if (!touch) gesture = { scale, anchor: point(event.clientX ?? center().x, event.clientY ?? center().y) };
    }, { passive: false });
    viewport.addEventListener('gesturechange', event => {
      if (!gesture || touch) return;
      event.preventDefault();
      zoom(gesture.scale * event.scale, event.clientX ?? center().x, event.clientY ?? center().y, gesture.anchor);
    }, { passive: false });
    viewport.addEventListener('gestureend', () => { gesture = null; });
    viewport.addEventListener('pointerdown', event => {
      if (!enabled() || event.pointerType !== 'mouse' || event.button !== 0) return;
      viewport.focus({ preventScroll: true });
      if (scale <= 1.01) return;
      event.preventDefault();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      viewport.setPointerCapture(event.pointerId);
      viewport.dataset.dragging = 'true';
    });
    viewport.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      viewport.scrollLeft = drag.left + drag.x - event.clientX;
      viewport.scrollTop = drag.top + drag.y - event.clientY;
    });
    const endDrag = () => { drag = null; delete viewport.dataset.dragging; };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('lostpointercapture', endDrag);
    return {
      get scale() { return scale; },
      set: zoom,
      reset() {
        scale = 1; touch = null; gesture = null; endDrag();
        viewport.dataset.zoomed = 'false';
        onZoom(1);
      },
    };
  };
})();
