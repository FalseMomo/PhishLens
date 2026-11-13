'use strict';

// Identifies the open Gmail message. Reads DOM ids only.
// Do not read subjects, addresses, bodies, headers, or links here.

(function () {
  function clean(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  function messageNodes(root) {
    const main = root.querySelector('[role="main"]');
    const scope = main || root;
    return Array.from(scope.querySelectorAll('[data-legacy-message-id]')).filter((node) => {
      return !node.closest('tr.zA');
    });
  }

  function isExpanded(node) {
    if (node.classList.contains('ads')) return true;
    const container = node.closest('.adn');
    return Boolean(container && container.classList.contains('ads'));
  }

  function dedupe(nodes) {
    const byId = new Map();
    nodes.forEach((node) => {
      const id = clean(node.getAttribute('data-legacy-message-id'));
      if (!id) return;
      const current = byId.get(id);
      if (!current || (isExpanded(node) && !isExpanded(current))) {
        byId.set(id, node);
      }
    });
    return Array.from(byId.values());
  }

  function threadIdFor(node, root) {
    const carrier = node.closest('[data-legacy-thread-id]');
    if (carrier) return clean(carrier.getAttribute('data-legacy-thread-id'));
    const fallback = root.querySelector('[role="main"] [data-legacy-thread-id]');
    return fallback ? clean(fallback.getAttribute('data-legacy-thread-id')) : null;
  }

  function detected(node, root) {
    return {
      status: 'detected',
      legacyMessageId: clean(node.getAttribute('data-legacy-message-id')),
      messageDomId: clean(node.getAttribute('data-message-id')),
      threadId: threadIdFor(node, root)
    };
  }

  function findSelection(root) {
    const nodes = dedupe(messageNodes(root));
    if (nodes.length === 0) {
      return { status: 'none' };
    }

    const expanded = nodes.filter(isExpanded);
    if (expanded.length === 1) {
      return detected(expanded[0], root);
    }
    if (expanded.length === 0 && nodes.length === 1) {
      return detected(nodes[0], root);
    }

    return {
      status: 'ambiguous',
      messageCount: nodes.length,
      expandedCount: expanded.length
    };
  }

  globalThis.PhishLensSelection = { findSelection };
})();
