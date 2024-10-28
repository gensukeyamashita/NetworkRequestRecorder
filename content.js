let lastMousePosition = { x: 0, y: 0 };

// Track mouse movements
document.addEventListener('mousemove', (e) => {
  lastMousePosition = { x: e.clientX, y: e.clientY };
});

// Capture the clicked element and send to background
document.addEventListener('click', (e) => {
  const clickedElement = e.target.outerHTML.substring(0, 200); // Limit to first 200 chars for brevity
  chrome.runtime.sendMessage({
    action: 'elementClicked',
    element: clickedElement,
    mousePosition: lastMousePosition
  });
});
