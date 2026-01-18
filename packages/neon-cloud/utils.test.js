/**
 * Tests for neon-cloud utility functions
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { timeAgo, deepEqual, generateId, debounce } from './utils.js';

describe('timeAgo', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns empty string for falsy input', () => {
        expect(timeAgo(null)).toBe('');
        expect(timeAgo(undefined)).toBe('');
        expect(timeAgo('')).toBe('');
        expect(timeAgo(0)).toBe('');
    });

    it('returns "just now" for timestamps less than 60 seconds ago', () => {
        const now = new Date();
        expect(timeAgo(now)).toBe('just now');
        expect(timeAgo(new Date(now - 30000))).toBe('just now');
        expect(timeAgo(new Date(now - 59000))).toBe('just now');
    });

    it('returns minutes ago for timestamps less than an hour ago', () => {
        const now = new Date();
        expect(timeAgo(new Date(now - 60000))).toBe('1m ago');
        expect(timeAgo(new Date(now - 120000))).toBe('2m ago');
        expect(timeAgo(new Date(now - 30 * 60000))).toBe('30m ago');
        expect(timeAgo(new Date(now - 59 * 60000))).toBe('59m ago');
    });

    it('returns hours ago for timestamps less than a day ago', () => {
        const now = new Date();
        expect(timeAgo(new Date(now - 3600000))).toBe('1h ago');
        expect(timeAgo(new Date(now - 2 * 3600000))).toBe('2h ago');
        expect(timeAgo(new Date(now - 23 * 3600000))).toBe('23h ago');
    });

    it('returns days ago for timestamps less than a week ago', () => {
        const now = new Date();
        expect(timeAgo(new Date(now - 86400000))).toBe('1d ago');
        expect(timeAgo(new Date(now - 3 * 86400000))).toBe('3d ago');
        expect(timeAgo(new Date(now - 6 * 86400000))).toBe('6d ago');
    });

    it('returns formatted date for timestamps older than a week', () => {
        const oldDate = new Date('2024-01-01T12:00:00Z');
        const result = timeAgo(oldDate);
        expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/);
    });

    it('handles string timestamps', () => {
        const now = new Date();
        const thirtySecondsAgo = new Date(now - 30000).toISOString();
        expect(timeAgo(thirtySecondsAgo)).toBe('just now');
    });

    it('handles numeric timestamps', () => {
        const now = Date.now();
        expect(timeAgo(now - 30000)).toBe('just now');
        expect(timeAgo(now - 120000)).toBe('2m ago');
    });
});

describe('deepEqual', () => {
    it('returns true for identical primitives', () => {
        expect(deepEqual(1, 1)).toBe(true);
        expect(deepEqual('test', 'test')).toBe(true);
        expect(deepEqual(true, true)).toBe(true);
        expect(deepEqual(null, null)).toBe(true);
        expect(deepEqual(undefined, undefined)).toBe(true);
    });

    it('returns false for different primitives', () => {
        expect(deepEqual(1, 2)).toBe(false);
        expect(deepEqual('a', 'b')).toBe(false);
        expect(deepEqual(true, false)).toBe(false);
        expect(deepEqual(1, '1')).toBe(false);
    });

    it('returns false when one value is null', () => {
        expect(deepEqual(null, {})).toBe(false);
        expect(deepEqual({}, null)).toBe(false);
        expect(deepEqual(null, 'test')).toBe(false);
    });

    it('returns true for equal simple objects', () => {
        expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
        expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
        expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    });

    it('returns false for different objects', () => {
        expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
        expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
        expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it('handles nested objects', () => {
        const obj1 = { a: { b: { c: 1 } } };
        const obj2 = { a: { b: { c: 1 } } };
        const obj3 = { a: { b: { c: 2 } } };

        expect(deepEqual(obj1, obj2)).toBe(true);
        expect(deepEqual(obj1, obj3)).toBe(false);
    });

    it('handles arrays', () => {
        expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
        expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it('handles objects with arrays', () => {
        const obj1 = { items: [1, 2, 3] };
        const obj2 = { items: [1, 2, 3] };
        const obj3 = { items: [1, 2, 4] };

        expect(deepEqual(obj1, obj2)).toBe(true);
        expect(deepEqual(obj1, obj3)).toBe(false);
    });

    it('handles empty objects and arrays', () => {
        expect(deepEqual({}, {})).toBe(true);
        expect(deepEqual([], [])).toBe(true);
        // Note: deepEqual treats {} and [] as equal since both have no keys
        // This is a known limitation - it uses Object.keys() comparison
        expect(deepEqual({}, [])).toBe(true);
    });
});

describe('generateId', () => {
    it('returns a string', () => {
        const id = generateId();
        expect(typeof id).toBe('string');
    });

    it('returns non-empty string', () => {
        const id = generateId();
        expect(id.length).toBeGreaterThan(0);
    });

    it('generates unique IDs', () => {
        const ids = new Set();
        for (let i = 0; i < 100; i++) {
            ids.add(generateId());
        }
        expect(ids.size).toBe(100);
    });

    it('contains alphanumeric characters', () => {
        const id = generateId();
        expect(id).toMatch(/^[a-z0-9]+$/);
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

    it('only calls function once for rapid calls', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced();
        debounced();
        debounced();

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
        debounced();
        jest.advanceTimersByTime(50);

        expect(fn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passes arguments to debounced function', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);

        debounced('arg1', 'arg2');
        jest.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('uses the last call arguments', () => {
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
            getValue: jest.fn(function() { return this.value; })
        };
        obj.debouncedGetValue = debounce(obj.getValue, 100);

        obj.debouncedGetValue();
        jest.advanceTimersByTime(100);

        expect(obj.getValue).toHaveBeenCalled();
        expect(obj.getValue.mock.instances[0]).toBe(obj);
    });
});
