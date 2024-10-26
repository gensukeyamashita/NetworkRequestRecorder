let isRecording = false;

function getElementInfo(element) {
  const rect = element.getBoundingClientRect();
  
  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    classes: Array.from(element.classList),
    text: element.textContent?.trim().substring(0, 50) || null,
    attributes: Array.from(element.attributes).reduce((acc, attr) => {
      acc[attr.name] = attr.value;
      return acc;
    }, {}),
    xpath: getXPath(element),
    dimensions: {
      x: rect.x + window.scrollX,
      y: rect.y + window.scrollY,
      width: rect.width,
      height: rect.height
    }
  };
}

function getXPath(element) {
  if (!element) return '';
  if (element.id) return `//*[@id="${element.id}"]`;
  
  let path = [];
  while (element && element.nodeType === Node.ELEMENT_NODE) {
    let selector = element.nodeName.toLowerCase();
    let siblings = element.parentNode ? Array.from(element.parentNode.children) : [];
    
    if (siblings.length > 1) {
      let index = siblings.indexOf(element) + 1;
      if (index > 1) selector += `[${index}]`;
    }
    
    path.unshift(selector);
    element = element.parentNode;
  }
  
  return '/' + path.join('/');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startRecording') {
    isRecording = true;
    sendResponse({ status: 'Content script started recording' });
  } else if (message.action === 'stopRecording') {
    isRecording = false;
    sendResponse({ status: 'Content script stopped recording' });
  }
  return true;
});

document.addEventListener('click', (event) => {
  if (!isRecording) return;
  
  const clickEvent = {
    timestamp: new Date().toISOString(),
    type: 'click',
    coordinates: {
      pageX: event.pageX,
      pageY: event.pageY,
      clientX: event.clientX,
      clientY: event.clientY
    },
    target: getElementInfo(event.target),
    url: window.location.href,
    title: document.title
  };
  
  chrome.runtime.sendMessage({
    action: 'recordClick',
    data: clickEvent
  });
});
