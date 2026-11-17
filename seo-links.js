(function () {
  'use strict';
  const officialHome = 'https://www.moi.gov.sa/';
  const labels = ['عرض الكل', 'تفاصيل الحدث'];
  function normalized(el) { return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function activate(root) {
    root.querySelectorAll('button').forEach(function (button) {
      const label = normalized(button);
      if (!labels.some(x => label.includes(x)) || button.dataset.officialLinkBound) return;
      button.dataset.officialLinkBound = '1';
      button.setAttribute('type', 'button');
      button.setAttribute('aria-label', label + ' - موقع وزارة الداخلية السعودية الرسمي');
      button.addEventListener('click', function (event) {
        event.preventDefault();
        window.open(officialHome, '_blank', 'noopener,noreferrer');
      });
    });
    root.querySelectorAll('footer a, app-footer a').forEach(function (link) {
      if (link.dataset.officialLinkBound) return;
      link.dataset.officialLinkBound = '1';
      link.href = officialHome;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.addEventListener('click', function (event) {
        event.preventDefault();
        window.open(officialHome, '_blank', 'noopener,noreferrer');
      });
    });
    root.querySelectorAll('app-navbar a').forEach(function (link) {
      if (normalized(link) === 'الرئيسية' && !link.dataset.officialLinkBound) {
        link.dataset.officialLinkBound = '1';
        link.href = officialHome;
        link.removeAttribute('routerlink');
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.addEventListener('click', function (event) {
          event.preventDefault();
          window.open(officialHome, '_blank', 'noopener,noreferrer');
        });
      }
    });
  }
  function start() {
    if (!document.body) return;
    activate(document);
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) activate(node);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
