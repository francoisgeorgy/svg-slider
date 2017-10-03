
"use strict";

import palettes from './palettes.js';

/**
 *
 * @param elem DIV or SVN element
 * @param conf optional config
 * @returns {{value, config}}
 */
export default function(elem, conf = {}) {

    if (!elem) {
        throw 'You must pass a DOM node reference to the slider constructor';
    }

    let trace = false;    // when true, will log more details in the console; use enableDebug(), disableDebug() to change

    const NS = "http://www.w3.org/2000/svg";

    //---------------------------------------------------------------------
    /*
          +--------------+ VIEWBOX_HEIGHT=99
          |              |
          |   /------\   |      ^
          |   |      |   |      |
          |   |      |   |      | track_length: 0..(99 - track_offset) [viewbox units]
          |   |      |   |      |
          | /----------\ |      |       ^
          | |  cursor  | |      |       | cursor_height: 0..(99 - track_offset) [viewbox units]
          | \----------/ |      |   ^   v
          |   |      |   |      |   |
          |   |  T   |   |      |   |
          |   |  R   |   |      |   |
          |   |  A   |   |      |   | position: 0..track_length [viewbox units]
          |   |  C   |   |      |   |
          |   |  K   |   |      |   |
          |   |      |   |      |   |
          |   \------/   |  ^   v   -
          |              |  | track_offset: 0..99 [viewbox units]
          +--------------+  v

        by default: - track_bg_offset = track_offset
                    - track_bg_length = track_length
                    - track_bg_width  = track_width

        position = 0..track_length
        value = value_min..value_max
     */

    const VIEWBOX_HEIGHT = 100;
    // const VIEWBOX_WIDTH = 20;

    let svg_element;

    /*
    if (typeof elem === "string") {
        element = document.querySelector(elem);
    } else if (elem instanceof HTMLElement) {
        element = elem;
    }
    */

    if (elem.nodeName.toLowerCase() === 'svg') {
        svg_element = elem;
    } else {
        svg_element = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        elem.appendChild(svg_element);
    }

    let defaults = {

        // User configurable properties. The colors are defined in the 'palettes', later on.
        // No camelCase because we want to be able to have the same name in data- attributes.

        width: 20,                  // on a 1..100 scale; height is always 100

        // background:
        bg_width: 20,
        bg_border_width: 1,

        // markers:
        markers: 4,                         // number of markers; 0 or false to disable
        markers_length: 18,
        markers_width: 0.5,

        // track background:
        track_bg_offset: 10,
        track_bg_length: 80,
        track_bg_width: 10,
        track_bg_radius: 5,
        // track_bg_border_width: 0,
        // track_bg_border_color: '',

        // track:
        track_offset: 10,
        track_length: 80,
        track_width: 10,
        track_radius: 5,

        // cursor
        cursor_width: 16,
        cursor_height: 6,
        cursor_border_width: 10,
        cursor_radius: 2,

        // value range
        default_value: 0,
        initial_value: 0,
        value_min: 0.0,
        value_max: 100.0,
        value_resolution: 1,        // null means ignore

        // appearance:
        palette: 'lightgray',
        bg: false,
        track_bg: true,
        track: true,
        cursor: true,
        // CSS class names
        linecap: 'butt',                   // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linecap
        value_text: true,
        // value_position: HALF_HEIGHT + 8,    // empirical value: HALF_HEIGHT + config.font_size / 3
        // value_formatting: null,          // TODO; callback function
        format: v => v,                     // formatting of the displayed value
    
        font_family: 'sans-serif',
        font_size: 25,
        font_weight: 'bold',

        class_bg: 'slider-bg',
        class_track_bg : 'slider-track-bg',
        class_track : 'slider-track',
        class_value : 'slider-value',
        class_cursor : 'slider-cursor',
        class_markers: 'slider-markers',

        snap_to_steps: false,       // TODO

        // mouse wheel support:
        mouse_wheel_acceleration: 1,

        onchange: null              // callback function
    };

    //---------------------------------------------------------------------
    // Consolidate all configs:

    let data_config = JSON.parse(elem.dataset.config || '{}');
    let c = Object.assign({}, defaults, palettes[defaults.palette], conf, data_config);
    // we re-assign conf and data_config for the case they override some of the palette colors.
    let config = Object.assign(c, palettes[c.palette], conf, data_config);

    //---------------------------------------------------------------------
    // SVG element setup:

    // For the use of null argument with setAttributeNS, see https://developer.mozilla.org/en-US/docs/Web/SVG/Namespaces_Crash_Course#Scripting_in_namespaced_XML
    svg_element.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
    svg_element.setAttributeNS(null, "viewBox", `0 0 ${config.width} ${VIEWBOX_HEIGHT}`);

    //---------------------------------------------------------------------
    // internals

    let value = 0.0;                   // current slider's value [value_min..value_max]
    let position = 0;                  // current slider's position [0..track_length]
    let mouse_wheel_direction = 1;     // dependant of the OS

    //---------------------------------------------------------------------
    // SVG elements, from back to front:
    let svg_bg = null;           // background
    let svg_track_bg = null;     // track background
    let svg_track = null;
    let svg_cursor = null;
    let svg_markers = null;
    let svg_value_text = null;

    //---------------------------------------------------------------------
    // mouse support
    let targetRect;
    let minDeltaY;

    //---------------------------------------------------------------------
    // true if the current slider value is different from the default value
    let has_changed = false;    // to spare some getValue() calls when testing if value has changed from default_value

    //---------------------------------------------------------------------
    // Create the slider:

    init();
    draw();
    attachEventHandlers();


    /**
     * Having a init function allow the slider to be re-configured.
     */
    function init() {

        // set initial value and position:
        setValue(config.initial_value ? config.initial_value : config.default_value);

        // mouse_wheel_direction = _isMacOS() ? -1 : 1; //TODO: really necessary?
    }

    /**
     * Return the value "rounded" according to config.value_resolution
     * @param v value
     */
    function getRoundedValue(v) {
        return config.value_resolution === null ? v : Math.round(v / config.value_resolution) * config.value_resolution;
    }

    /**
     *
     * @param a slider's position [0..track_length]
     * @returns {*}
     */
    function getDisplayValue(position) {
        let v = getValue(position);
        return config.format(v);
    }

    /**
     * Get the slider's value determined by the slider's position (position)
     * @param a slider's position [0..track_length]
     * @returns {number}
     */
    function getValue(a) {
        let v = ((a || position) / config.track_length) * (config.value_max - config.value_min) + config.value_min;
        return getRoundedValue(v);
    }

    /**
     * Set slider's value
     * @param v
     */
    function setValue(v) {
        if (v < config.value_min) {
            value = config.value_min;
        } else if (v > config.value_max) {
            value = config.value_max;
        } else {
            value = v;
        }
        setPosition(((v - config.value_min) / (config.value_max - config.value_min)) * config.track_length);
        return true;
    }

    /**
     * Set slider's position
     * @param new_position
     */
    function setPosition(new_position, fire_event) {
        let prev = position;
        let notify = fire_event && (new_position !== position);
        position = Math.min(Math.max(new_position, 0), config.track_length);
        if (notify) {
            // fire the event if the change of position affect the value:
            if (getValue(prev) !== getValue()) {
                notifyChange();
            }
        }
    }

    /**
     * Increment (or decrement if the increment is negative) the slider's position.
     * @param increment
     */
    function incPosition(increment) {
        setPosition(Math.min(Math.max(position + increment, 0), config.track_length), true);
    }

    /**
     * startDrag() must have been called before to init the targetRect variable.
     */
    function mouseUpdate(e) {

        // MouseEvent.clientX (standard property: YES)
        // The clientX read-only property of the MouseEvent interface provides
        // the horizontal coordinate within the application's client area at which
        // the event occurred (as opposed to the coordinates within the page).
        // For example, clicking in the top-left corner of the client area will always
        // result in a mouse event with a clientX value of 0, regardless of whether
        // the page is scrolled horizontally. Originally, this property was defined
        // as a long integer. The CSSOM View Module redefined it as a double float.

        // let dxPixels = e.clientX - targetRect.left;
        let dyPixels = e.clientY - targetRect.top;

        // let dx = dxPixels / targetRect.width * config.width;
        let dy = getViewboxY(dyPixels / targetRect.height * VIEWBOX_HEIGHT + config.track_offset);
        position = Math.min(Math.max(dy, 0), config.track_length);
    }

    /**
     *
     * @param e
     */
    function startDrag(e) {

        if (trace) console.log('startDrag');

        e.preventDefault();

        // API: Event.currentTarget
        //      Identifies the current target for the event, as the event traverses the DOM. It always REFERS TO THE ELEMENT
        //      TO WHICH THE EVENT HANDLER HAS BEEN ATTACHED, as opposed to event.target which identifies the element on
        //      which the event occurred.
        //      https://developer.mozilla.org/en-US/docs/Web/API/Event/currentTarget

        // currentTarget = e.currentTarget;

        // API: Element.getBoundingClientRect() (standard: YES)
        //      The Element.getBoundingClientRect() method returns the size of an element
        //      and its POSITION RELATIVE TO THE VIEWPORT.
        //      The amount of scrolling that has been done of the viewport area (or any other
        //      scrollable element) is taken into account when computing the bounding rectposition.
        //      This means that the rectposition's boundary edges (top, left, bottom, and right)
        //      change their values every time the scrolling position changes (because their
        //      values are relative to the viewport and not absolute).
        //      https://developer.mozilla.org/en/docs/Web/API/Element/getBoundingClientRect

        // targetRect = currentTarget.getBoundingClientRect(); // currentTarget must be the <svg...> object
        targetRect = svg_element.getBoundingClientRect();

        // Note: we must take the boundingClientRect of the <svg> and not the <path> because the <path> bounding rect
        //       is not constant because it encloses the current arc.

        document.addEventListener('mousemove', handleDrag, false);
        document.addEventListener('mouseup', endDrag, false);

        mouseUpdate(e);
        redraw();
    }

    /**
     *
     * @param e
     */
    function handleDrag(e) {
        e.preventDefault();
        mouseUpdate(e);
        redraw();
    }

    /**
     *
     */
    function endDrag() {
        if (trace) console.log('endDrag');
        document.removeEventListener('mousemove', handleDrag, false);
        document.removeEventListener('mouseup', endDrag, false);
    }

    /**
     *
     * @param e
     * @returns {boolean}
     */
    function mouseWheelHandler(e) {

        // WheelEvent
        // This is the standard wheel event interface to use. Old versions of browsers implemented the two non-standard
        // and non-cross-browser-compatible MouseWheelEvent and MouseScrollEvent interfaces. Use this interface and avoid
        // the latter two.
        // The WheelEvent interface represents events that occur due to the user moving a mouse wheel or similar input device.

        // https://stackoverflow.com/questions/5527601/normalizing-mousewheel-speed-across-browsers
        // https://github.com/facebook/fixed-data-table/blob/master/src/vendor_upstream/dom/normalizeWheel.js

        e.preventDefault();

        let dy = e.deltaY;

        if (dy !== 0) {
            // normalize Y delta
            if (minDeltaY > Math.abs(dy) || !minDeltaY) {
                minDeltaY = Math.abs(dy);
            }
        }

        incPosition(dy / minDeltaY * mouse_wheel_direction * config.mouse_wheel_acceleration);

        // TODO: mouse speed detection (https://stackoverflow.com/questions/22593286/detect-measure-scroll-speed)

        redraw();

        return false;
    }

    /**
     *
     */
    function attachEventHandlers() {
        svg_element.addEventListener("mousedown", function(e) {
            startDrag(e);
        });
        svg_element.addEventListener("wheel", function(e) {
            mouseWheelHandler(e);
        });
    }

    /**
     *
     */
    function notifyChange() {
        if (trace) console.log('slider value has changed');
        let value = getValue();     // TODO: cache the value
        let event = new CustomEvent('change', {'detail': value});
        elem.dispatchEvent(event);
        if (config.onchange) {
            config.onchange(value);
        }
    }

    /**
     * Utility function to configure the mousewheel direction.
     * @returns {*}
     * @private
     */
    function _isMacOS() {
        return ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'].indexOf(window.navigator.platform) !== -1;
    }

    /**
     * Return viewBox Y coordinate
     */
    function getViewboxY(y) {
        return Math.min(Math.max(VIEWBOX_HEIGHT - y, 0), VIEWBOX_HEIGHT);
    }

    /**
     *
     */
    function draw_background() {

        if (!config.bg) return;

        // For the use of null argument with setAttributeNS, see https://developer.mozilla.org/en-US/docs/Web/SVG/Namespaces_Crash_Course#Scripting_in_namespaced_XML

        svg_bg = document.createElementNS(NS, "rect");
        svg_bg.setAttributeNS(null, "x", '0');
        svg_bg.setAttributeNS(null, "y", '0');
        svg_bg.setAttributeNS(null, "width", `${config.width}`);
        svg_bg.setAttributeNS(null, "height", `${VIEWBOX_HEIGHT}`);
        svg_bg.setAttributeNS(null, "rx", '0');     // Determines the horizontal corner radius of the rect.
        svg_bg.setAttributeNS(null, "ry", '1');     // Determines the vertical corner radius of the rect.
        svg_bg.setAttribute("fill", `${config.bg_color}`);
        svg_bg.setAttribute("stroke", `${config.bg_border_color}`);
        svg_bg.setAttribute("stroke-width", `${config.bg_border_width}`);
        svg_bg.setAttribute("class", config.class_bg);
        svg_element.appendChild(svg_bg);
    }

    /**
     *
     */
    function draw_markers() {

        if (!config.markers) return;

        let x0 = (config.width - config.markers_length) / 2;
        let x1 = config.markers_length;

        let p = '';
        let k = config.markers;
        for (let i = 0; i <= k; i++) {
            let y = getViewboxY(config.track_offset + (config.track_length / k * i));
            if (trace) console.log(y);
            p += `M ${x0},${y} L ${x1},${y} `;
        }

        svg_markers = document.createElementNS(NS, "path");
        svg_markers.setAttributeNS(null, "d", p);
        svg_markers.setAttribute("stroke", `${config.markers_color}`);
        svg_markers.setAttribute("stroke-width", `${config.markers_width}`);
        svg_markers.setAttribute("stroke-linecap", config.linecap);
        svg_markers.setAttribute("class", config.class_markers);
        svg_element.appendChild(svg_markers);
    }

    /**
     *
     */
    function draw_track_background() {

        // For the use of null argument with setAttributeNS, see https://developer.mozilla.org/en-US/docs/Web/SVG/Namespaces_Crash_Course#Scripting_in_namespaced_XML

        if (!config.track_bg) return;

        svg_track_bg = document.createElementNS(NS, "rect");
        svg_track_bg.setAttributeNS(null, "x", `${(config.width - config.track_bg_width) / 2}`);
        svg_track_bg.setAttributeNS(null, "y", `${getViewboxY(config.track_bg_offset + config.track_bg_length + config.track_bg_radius)}`);
        svg_track_bg.setAttributeNS(null, "width", `${config.track_bg_width}`);
        svg_track_bg.setAttributeNS(null, "height", `${config.track_bg_length + (2 * config.track_bg_radius)}`);
        svg_track_bg.setAttributeNS(null, "rx", '5');     // Determines the horizontal corner radius of the rect.
        svg_track_bg.setAttributeNS(null, "ry", '5');     // Determines the vertical corner radius of the rect.
        svg_track_bg.setAttribute("stroke", `${config.track_color}`);
        svg_track_bg.setAttribute("stroke-width", '0.5');
        svg_track_bg.setAttribute("fill", `${config.track_bg_color}`);
        svg_track_bg.setAttribute("class", config.class_track_bg);
        svg_element.appendChild(svg_track_bg);
    }

    /**
     *
     */
    function draw_track() {
        if (!config.track) return;

        if (!svg_track) {
            svg_track = document.createElementNS(NS, "rect");
            svg_track.setAttributeNS(null, "x", `${(config.width - config.track_width) / 2}`);
            svg_track.setAttributeNS(null, "width", `${config.track_width}`);
            svg_track.setAttributeNS(null, "rx", '5');     // Determines the horizontal corner radius of the rect.
            svg_track.setAttributeNS(null, "ry", '5');     // Determines the vertical corner radius of the rect.
            // svg_track.setAttribute("stroke", `${config.track_color_init}`);
            svg_track.setAttribute("stroke-width", '0');
            svg_track.setAttribute("fill", `${config.track_color}`);
            // svg_track.setAttribute("stroke-linecap", config.linecap);
            svg_track.setAttribute("class", config.class_track);
            svg_element.appendChild(svg_track);
        }
        svg_track.setAttributeNS(null, "y", `${getViewboxY(config.track_offset + position + config.track_radius)}`);
        svg_track.setAttributeNS(null, "height", `${position + (2 *  + config.track_radius)}`);
    }

    /**
     *
     */
    function draw_cursor() {

        if (!config.cursor) return;

        if (!svg_cursor) {
            svg_cursor = document.createElementNS(NS, "rect");
            svg_cursor.setAttributeNS(null, "x", `${(config.width - config.cursor_width) / 2}`);
            svg_cursor.setAttributeNS(null, "width", `${config.cursor_width}`);
            svg_cursor.setAttributeNS(null, "height", `${config.cursor_height}`);
            svg_cursor.setAttributeNS(null, "rx", `${config.cursor_radius}`);     // Determines the horizontal corner radius of the rect.
            svg_cursor.setAttributeNS(null, "ry", `${config.cursor_radius}`);     // Determines the vertical corner radius of the rect.
            // svg_cursor.setAttribute("stroke", `${config.track_bg_color}`);
            svg_cursor.setAttribute("stroke-width", '0');
            svg_cursor.setAttribute("fill", `${config.cursor_color}`);
            // svg_cursor.setAttribute("stroke-linecap", config.linecap);
            svg_cursor.setAttribute("class", config.class_cursor);
            svg_element.appendChild(svg_cursor);
        }
        svg_cursor.setAttributeNS(null, "y", `${getViewboxY(config.track_offset + config.cursor_height / 2 + position)}`);
    }

    /**
     *
     */
    function draw_value() {

        if (!config.value_text) return;

/*
        svg_value_text = document.createElementNS(NS, "text");
        svg_value_text.setAttributeNS(null, "x", `${HALF_WIDTH}`);
        svg_value_text.setAttributeNS(null, "y", `${config.value_position}`);
        svg_value_text.setAttribute("text-anchor", "middle");
        svg_value_text.setAttribute("cursor", "default");
        svg_value_text.setAttribute("font-family", config.font_family);
        svg_value_text.setAttribute("font-size", `${config.font_size}`);
        svg_value_text.setAttribute("font-weight", `${config.font_weight}`);
        svg_value_text.setAttribute("fill", config.font_color);
        svg_value_text.setAttribute("class", config.class_value);
        svg_value_text.textContent = getDisplayValue();
        svg_element.appendChild(svg_value_text);
*/
    }

    /**
     *
     */
    function draw() {
        draw_background();
        draw_markers();
        draw_track_background();
        // draw_units();
        draw_track();
        draw_cursor();
        draw_value();
    }

    /**
     *
     */
    function redraw() {

        draw_track();
        draw_cursor();

        if (!has_changed) {
            has_changed = getValue() !== config.default_value;
            // if (has_changed) {
            //     if (svg_track) svg_track.setAttribute("stroke", `${config.track_color}`);
            // }
        }

        if (svg_value_text) {
            svg_value_text.textContent = getDisplayValue();
        }
    }

    /**
     *
     */
    return {
        set value(v) {
            setValue(v);
            redraw();
        },
        set config(new_config) {
            config = Object.assign({}, defaults, conf, new_config);
            init();
            draw();
        },
        enableDebug: function() {
            trace = true;
        },
        disableDebug: function() {
            trace = false;
        }
    };

}
