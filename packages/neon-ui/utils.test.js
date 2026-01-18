/**
 * Tests for neon-ui DOM utility functions
 * @jest-environment jsdom
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { el, queryAll, query, sleep, debounce, throttle, on, createElement } from './utils.js';

describe('el', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="test-element">Test Content</div>
            <div id="another-element">Another</div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('returns element by ID', () => {
        const element = el('test-element');
        expect(element).not.toBeNull();
        expect(element.textContent).toBe('Test Content');
    });

    it('returns null for non-existent ID', () => {
        const element = el('non-existent');
        expect(element).toBeNull();
    });
});

describe('queryAll', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="item">Item 1</div>
            <div class="item">Item 2</div>
            <div class="item">Item 3</div>
            <div class="other">Other</div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('returns all matching elements', () => {
        const elements = queryAll('.item');
        expect(elements.length).toBe(3);
    });

    it('returns empty NodeList for no matches', () => {
        const elements = queryAll('.non-existent');
        expect(elements.length).toBe(0);
    });

    it('searches within parent element', () => {
        document.body.innerHTML = `
            <div id="parent">
                <div class="item">Child 1</div>
                <div class="item">Child 2</div>
            </div>
            <div class="item">Outside</div>
        `;
        const parent = document.getElementById('parent');
        const elements = queryAll('.item', parent);
        expect(elements.length).toBe(2);
    });
});

describe('query', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="item">First</div>
            <div class="item">Second</div>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('returns first matching element', () => {
        const element = query('.item');
        expect(element).not.toBeNull();
        expect(element.textContent).toBe('First');
    });

    it('returns null for no matches', () => {
        const element = query('.non-existent');
        expect(element).toBeNull();
    });

    it('searches within parent element', () => {
        document.body.innerHTML = `
            <div id="parent">
                <div class="item">Child</div>
            </div>
            <div class="item">Outside</div>
        `;
        const parent = document.getElementById('parent');
        const element = query('.item', parent);
        expect(element.textContent).toBe('Child');
    });
});

describe('sleep', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns a promise', () => {
        const result = sleep(100);
        expect(result).toBeInstanceOf(Promise);
    });

    it('resolves after specified time', async () => {
        const callback = jest.fn();
        sleep(100).then(callback);

        expect(callback).not.toHaveBeenCalled();

        jest.advanceTimersByTime(100);
        await Promise.resolve();

        expect(callback).toHaveBeenCalled();
    });

    it('resolves with undefined', async () => {
        const promise = sleep(0);
        jest.advanceTimersByTime(0);
        const result = await promise;
        expect(result).toBeUndefined();
    });
});

describe('debounce', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('delays function execution', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced();
        expect(fn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('resets timer on each call', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced();
        jest.advanceTimersByTime(50);
        debounced();
        jest.advanceTimersByTime(50);

        expect(fn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('only executes once for rapid calls', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced();
        debounced();
        debounced();

        jest.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passes arguments correctly', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced('arg1', 'arg2');
        jest.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('uses last call arguments', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced('first');
        debounced('second');
        debounced('third');

        jest.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledWith('third');
    });

    it('preserves this context', () => {
        const obj = {
            value: 42,
            fn: jest.fn(function() { return this.value; })
        };
        obj.debounced = debounce(obj.fn, 100);

        obj.debounced();
        jest.advanceTimersByTime(100);

        expect(obj.fn.mock.instances[0]).toBe(obj);
    });
});

describe('throttle', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('executes immediately on first call', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('blocks calls within throttle interval', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled();
        throttled();
        throttled();

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('allows call after interval has passed', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled();
        jest.advanceTimersByTime(100);
        throttled();

        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('passes arguments correctly', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);

        throttled('arg1', 'arg2');
        expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('preserves this context', () => {
        const obj = {
            value: 42,
            fn: jest.fn(function() { return this.value; })
        };
        obj.throttled = throttle(obj.fn, 100);

        obj.throttled();
        expect(obj.fn.mock.instances[0]).toBe(obj);
    });

    it('returns function result', () => {
        const fn = jest.fn().mockReturnValue('result');
        const throttled = throttle(fn, 100);

        expect(throttled()).toBe('result');
    });

    it('returns undefined when throttled', () => {
        const fn = jest.fn().mockReturnValue('result');
        const throttled = throttle(fn, 100);

        throttled();
        expect(throttled()).toBeUndefined();
    });
});

describe('on', () => {
    let element;

    beforeEach(() => {
        element = document.createElement('div');
    });

    it('adds event listener', () => {
        const handler = jest.fn();
        on(element, 'click', handler);

        element.dispatchEvent(new Event('click'));
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('returns cleanup function', () => {
        const handler = jest.fn();
        const cleanup = on(element, 'click', handler);

        expect(typeof cleanup).toBe('function');
    });

    it('cleanup removes event listener', () => {
        const handler = jest.fn();
        const cleanup = on(element, 'click', handler);

        element.dispatchEvent(new Event('click'));
        expect(handler).toHaveBeenCalledTimes(1);

        cleanup();

        element.dispatchEvent(new Event('click'));
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('passes event to handler', () => {
        const handler = jest.fn();
        on(element, 'click', handler);

        const event = new Event('click');
        element.dispatchEvent(event);

        expect(handler).toHaveBeenCalledWith(expect.any(Event));
    });

    it('supports event options', () => {
        const handler = jest.fn();
        on(element, 'click', handler, { once: true });

        element.dispatchEvent(new Event('click'));
        element.dispatchEvent(new Event('click'));

        expect(handler).toHaveBeenCalledTimes(1);
    });
});

describe('createElement', () => {
    it('creates element with tag name', () => {
        const element = createElement('div');
        expect(element.tagName).toBe('DIV');
    });

    it('sets className attribute', () => {
        const element = createElement('div', { className: 'test-class' });
        expect(element.className).toBe('test-class');
    });

    it('sets data attributes via dataset', () => {
        const element = createElement('div', { dataset: { id: '123', name: 'test' } });
        expect(element.dataset.id).toBe('123');
        expect(element.dataset.name).toBe('test');
    });

    it('sets style object', () => {
        const element = createElement('div', { style: { color: 'red', fontSize: '16px' } });
        expect(element.style.color).toBe('red');
        expect(element.style.fontSize).toBe('16px');
    });

    it('sets regular attributes', () => {
        const element = createElement('input', { type: 'text', placeholder: 'Enter text' });
        expect(element.getAttribute('type')).toBe('text');
        expect(element.getAttribute('placeholder')).toBe('Enter text');
    });

    it('adds event listeners for on* attributes', () => {
        const handler = jest.fn();
        const element = createElement('button', { onClick: handler });

        element.dispatchEvent(new Event('click'));
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('sets text content from string children', () => {
        const element = createElement('div', {}, 'Hello World');
        expect(element.textContent).toBe('Hello World');
    });

    it('appends child elements from array', () => {
        const child1 = document.createElement('span');
        child1.textContent = 'Child 1';
        const child2 = document.createElement('span');
        child2.textContent = 'Child 2';

        const element = createElement('div', {}, [child1, child2]);
        expect(element.children.length).toBe(2);
        expect(element.children[0].textContent).toBe('Child 1');
        expect(element.children[1].textContent).toBe('Child 2');
    });

    it('appends text nodes from string array items', () => {
        const element = createElement('div', {}, ['Hello', ' ', 'World']);
        expect(element.textContent).toBe('Hello World');
    });

    it('handles mixed children array', () => {
        const span = document.createElement('span');
        span.textContent = 'Span';

        const element = createElement('div', {}, ['Text ', span, ' More text']);
        expect(element.textContent).toBe('Text Span More text');
        expect(element.querySelector('span')).not.toBeNull();
    });

    it('ignores non-string, non-node children', () => {
        const element = createElement('div', {}, [null, undefined, 123]);
        expect(element.children.length).toBe(0);
        expect(element.textContent).toBe('');
    });

    it('creates nested elements', () => {
        const element = createElement('div', { className: 'parent' }, [
            createElement('span', { className: 'child' }, 'Nested')
        ]);

        expect(element.querySelector('.child')).not.toBeNull();
        expect(element.querySelector('.child').textContent).toBe('Nested');
    });
});
