/**
 * neon-ui/utils.js
 * Common DOM utilities and helpers
 */

/**
 * Get element by ID
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export const el = id => document.getElementById(id);

/**
 * Query all elements matching selector
 * @param {string} selector - CSS selector
 * @param {HTMLElement} [parent=document] - Parent element to search within
 * @returns {NodeListOf<Element>}
 */
export const queryAll = (selector, parent = document) => parent.querySelectorAll(selector);

/**
 * Query single element matching selector
 * @param {string} selector - CSS selector
 * @param {HTMLElement} [parent=document] - Parent element to search within
 * @returns {Element|null}
 */
export const query = (selector, parent = document) => parent.querySelector(selector);

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Debounce delay in milliseconds
 * @returns {Function}
 */
export function debounce(fn, ms) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), ms);
    };
}

/**
 * Throttle a function
 * @param {Function} fn - Function to throttle
 * @param {number} ms - Throttle interval in milliseconds
 * @returns {Function}
 */
export function throttle(fn, ms) {
    let lastCall = 0;
    return function(...args) {
        const now = Date.now();
        if (now - lastCall >= ms) {
            lastCall = now;
            return fn.apply(this, args);
        }
    };
}

/**
 * Add event listener with automatic cleanup
 * @param {HTMLElement} element - Target element
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @param {object} [options] - Event listener options
 * @returns {Function} Cleanup function
 */
export function on(element, event, handler, options) {
    element.addEventListener(event, handler, options);
    return () => element.removeEventListener(event, handler, options);
}

/**
 * Create element with attributes and children
 * @param {string} tag - HTML tag name
 * @param {object} [attrs] - Attributes to set
 * @param {Array|string} [children] - Child elements or text content
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'dataset' && typeof value === 'object') {
            Object.assign(element.dataset, value);
        } else {
            element.setAttribute(key, value);
        }
    }

    if (typeof children === 'string') {
        element.textContent = children;
    } else if (Array.isArray(children)) {
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
    }

    return element;
}
