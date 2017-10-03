
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

    // It is faster to access a property than to access a variable...
    // See https://jsperf.com/vars-vs-props-speed-comparison/1

    const NS = "http://www.w3.org/2000/svg";

    //---------------------------------------------------------------------
    // To simplify the internal coordinates transformations, we set the view box as a 100 by 100 square.

    /*
          +--------------+ VIEWBOX_HEIGHT=99
          |              |
          |   +------+   |      ^
          |   |      |   |      |
          |   |      |   |      | track_length: 0..(99 - track_offset) [viewbox units]
          |   |      |   |      |
          | +-+------+-+ |      |       ^
          | |  cursor  | |      |       | cursor_height: 0..(99 - track_offset) [viewbox units]
          | +-+------+-+ |      |   ^   v
          |   |      |   |      |   |
          |   |  T   |   |      |   |
          |   |  R   |   |      |   |
          |   |  A   |   |      |   | position: 0..track_length [viewbox units]
          |   |  C   |   |      |   |
          |   |  K   |   |      |   |
          |   |      |   |      |   |
          |   +------+   |  ^   v   -
          |              |  | track_offset: 0..99 [viewbox units]
          +--------------+  v

        by default: - track_bg_offset = track_offset
                    - track_bg_length = track_length
                    - track_bg_width  = track_width

        value = value_min..value_max
        position = 0..99



     */

    const VIEWBOX_HEIGHT = 99;
    // const VIEWBOX_WIDTH = 20;

    let svg_element;
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

        // center_zero: false,
        // center_value: null,         // if null, the value will be computed from the min and max in the init() method

        // position_min: 10,
        // position_max: 90,

        // appearance:
        palette: 'lightgray',
        bg: true,
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
        
        markers: 10,                         // number of markers; 0 or false to disable
        markers_length: 8,
        markers_width: 1,

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
    // let config = Object.assign({}, defaults, conf, data_config);
    // we re-assign conf and data_config for the case they override some of the palette colors.
    let config = Object.assign(c, palettes[c.palette], conf, data_config);

    //---------------------------------------------------------------------
    // Terminates the SVG element setup:

    // let viewbox_height = 100;
/*
    if (config.label || (config.value_position >= (100 - (config.font_size / 2)))) {
        // make some room for the label or the value that we want to display below the slider
        viewbox_height = 120;
    } else {
        viewbox_height = 100;
    }
*/

    // For the use of null argument with setAttributeNS, see https://developer.mozilla.org/en-US/docs/Web/SVG/Namespaces_Crash_Course#Scripting_in_namespaced_XML
    svg_element.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
    svg_element.setAttributeNS(null, "viewBox", `0 0 ${config.width-1} ${VIEWBOX_HEIGHT}`);

    //---------------------------------------------------------------------
    // internals

    let value = 0.0;                   // current slider's value [value_min..value_max]
    let position = 0;                  // current slider's position [0..track_length]
    let mouse_wheel_direction = 1;     // dependant of the OS

    //---------------------------------------------------------------------
    // SVG elements, from back to front:
    let svg_bg = null;           // background disk:
    let svg_track_bg = null;            // track background; for non zero-centered sliders
    let svg_track = null;
    let svg_cursor = null;
    let svg_divisions = null;
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

        if (config.center_zero) {
            if (!config.center_value) {
                config.center_value = getRoundedValue((config.value_max - config.value_min) / 2 + config.value_min);
            }
        }

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
     * @param position [deg] in slider's coordinates
     * @returns {*}
     */
    function getDisplayValue(position) {
        let v = getValue(position);
        return config.format(v);
    }

    /**
     * Get the slider's value determined by the slider's position (position)
     * @param a [deg] in slider's coordinates
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
     * Return polar coordinates position from our "slider coordinates" position
     */
/*
    function sliderToPolarPosition(position) {
        let a = config.zero_at - position;
        if (a < 0) a = a + 360.0;
        if (trace) console.log(`sliderToPolarPosition ${position} -> ${a}`);
        return a;
    }
*/

    /**
     *
     * @param position [deg] with 0 at 3 o'clock
     * @returns {number}
     */
/*
    function polarTosliderPosition(position) {
        // "-" for changing CCW to CW
        if (trace) console.log(`polarTosliderPosition ${position} -> ${(config.zero_at - position + 360.0) % 360.0}`);
        return (config.zero_at - position + 360.0) % 360.0;    // we add 360 to handle negative values down to -360
    }
*/

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

        let dxPixels = e.clientX - targetRect.left;
        let dyPixels = e.clientY - targetRect.top;

        // mouse delta in cartesian coordinate with path center=0,0 and scaled (-1..0..1) relative to path:
        // <svg> center:       (dx, dy) == ( 0,  0)
        // <svg> top-left:     (dx, dy) == (-1,  1)
        // <svg> bottom-right: (dx, dy) == ( 1, -1) (bottom right of the 100x100 viewBox, ignoring the bottom 100x20 for the label)
        let dx = (dxPixels - arcCenterXPixels) / (targetRect.width / 2);
        let dy = - (dyPixels - arcCenterYPixels) / (targetRect.width / 2);  // targetRect.width car on a 20px de plus en hauteur pour le label

        // if (config.rotation === CCW) dx = - dx;

        // convert to polar coordinates
        // let position_rad = Math.atan2(dy, dx);
        // if (position_rad < 0) position_rad = 2.0*Math.PI + position_rad;
        //
        // if (trace) console.log(`mouseUpdate: position in svg = ${dxPixels}, ${dyPixels} pixels; ${dx.toFixed(3)}, ${dy.toFixed(3)} rel.; position ${position_rad.toFixed(3)} rad`);

        // setPosition(polarTosliderPosition(position_rad * 180.0 / Math.PI), true);

        // distance from arc center to mouse position:
        // distance = Math.sqrt(dx*(HALF_WIDTH/config.track_width)*dx*(HALF_WIDTH/config.track_width) + dy*(HALF_HEIGHT/config.track_width)*dy*(HALF_HEIGHT/config.track_width));
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
        //svg_element.dispatchEvent(event);
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
        // console.log(`${y} --> ${Math.min(Math.max(VIEWBOX_HEIGHT - y, 0), VIEWBOX_HEIGHT)}`);
        return Math.min(Math.max(VIEWBOX_HEIGHT - y, 0), VIEWBOX_HEIGHT);
/*
        let a = position * Math.PI / 180.0;
        let r = radius || config.track_width;
        let x = Math.cos(a) * r;
        let y = Math.sin(a) * r;
        return {
            x: config.rotation === CW ? (HALF_WIDTH + x) : (HALF_WIDTH - x),
            y: HALF_HEIGHT - y
        }
*/
    }

    /**
     *
     * @param from_position in [degree] in slider's coordinates
     * @param to_position in [degree] in slider's coordinates
     * @param radius
     */
    /*
    function getArc(from_position, to_position, radius) {

        if (trace) console.group(`getArc(${from_position}, ${to_position}, ${radius})`);

        // SVG d: "A rx,ry xAxisRotate LargeArcFlag,SweepFlag x,y".
        // SweepFlag is either 0 or 1, and determines if the arc should be swept in a clockwise (1), or anti-clockwise (0) direction
        // ref: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d

        let a0 = sliderToPolarPosition(from_position);
        let a1 = sliderToPolarPosition(to_position);

        // little trick to force a full arc (360deg) when from=0 and to=360
        if (from_position !== to_position) {
            // with this we make sure that x1 will be different than x0 within the path definition
            a0 -= 0.0001;
            a1 += 0.0001;
        }

        let {x: x0, y: y0} = getViewboxCoord(a0, radius);
        let {x: x1, y: y1} = getViewboxCoord(a1, radius);

        let delta_position = (a0 - a1 + 360.0) % 360.0;

        let large_arc = delta_position < 180.0 ? 0 : 1;
        let arc_direction = config.rotation === CW ? 1 : 0;

        let p = `M ${x0},${y0} A ${radius},${radius} 0 ${large_arc},${arc_direction} ${x1},${y1}`;

        if (trace) console.groupEnd();
        if (trace) console.log("arc: " + p);

        return p;
    }
    */

    /**
     *
     * @returns {*}
     */
/*
    function getTrackPath() {

        let p = null;

        // p = getArc(0, position, config.track_width);

        return p;
    }
*/

    /**
     *
     */
    function draw_background() {

        if (!config.bg) return;

        // For the use of null argument with setAttributeNS, see https://developer.mozilla.org/en-US/docs/Web/SVG/Namespaces_Crash_Course#Scripting_in_namespaced_XML

        console.log("x", '0');
        console.log("y", '0');
        console.log("width", `${config.width-1}`);
        console.log("height", `${VIEWBOX_HEIGHT}`);

        svg_bg = document.createElementNS(NS, "rect");
        svg_bg.setAttributeNS(null, "x", '0');
        svg_bg.setAttributeNS(null, "y", '0');
        svg_bg.setAttributeNS(null, "width", `${config.width-1}`);
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

        // let x0 = (config.width - config.markers_length) / 2;
        // let x1 = x0 + config.markers_length;
        let x0 = 0;
        let x1 = config.width - 1;

        let p = '';
        let k = config.markers;
        // let step = config.track_length / config.markers;
        for (let i = 0; i <= k; i++) {
            let y = getViewboxY(config.track_offset + (config.track_length / k * i));
            console.log(y, x0, x1);
            p += `M ${x0},${y} L ${x1},${y} `;
        }

        svg_divisions = document.createElementNS(NS, "path");
        svg_divisions.setAttributeNS(null, "d", p);
        svg_divisions.setAttribute("stroke", `${config.markers_color}`);
        svg_divisions.setAttribute("stroke-width", `${config.markers_width}`);
        svg_divisions.setAttribute("stroke-linecap", config.linecap);
        svg_divisions.setAttribute("class", config.class_markers);
        svg_element.appendChild(svg_divisions);

    }

    /*
            function draw_units() {
                let pos = getViewboxCoord(position_min_polar, config.divisions_width);    // getViewboxCoord(position, radius)
                svg_value_text = document.createElementNS(NS, "text");
                svg_value_text.setAttributeNS(null, "x", `${pos.x}`);
                svg_value_text.setAttributeNS(null, "y", `${pos.y}`);
                // svg_value_text.setAttribute("text-anchor", "middle");
                svg_value_text.setAttribute("cursor", "default");
                svg_value_text.setAttribute("font-family", config.font_family);
                svg_value_text.setAttribute("font-size", `10`);
                // svg_value_text.setAttribute("font-weight", `${config.font_weight}`);
                svg_value_text.setAttribute("fill", config.font_color);
                // svg_value_text.setAttribute("class", config.class_value);
                // svg_value_text.textContent = getDisplayValue();
                svg_value_text.textContent = config.value_min.toString();
                svg_element.appendChild(svg_value_text);
            }
    */

    /**
     *
     */
    function draw_track_background() {

        // For the use of null argument with setAttributeNS, see https://developer.mozilla.org/en-US/docs/Web/SVG/Namespaces_Crash_Course#Scripting_in_namespaced_XML

        if (!config.track_bg) return;

        console.group('draw_track_background');

        svg_track_bg = document.createElementNS(NS, "rect");
        svg_track_bg.setAttributeNS(null, "x", `${(config.width - config.track_bg_width) / 2}`);
        svg_track_bg.setAttributeNS(null, "y", `${getViewboxY(config.track_bg_offset + config.track_bg_length + config.track_bg_radius)}`);
        svg_track_bg.setAttributeNS(null, "width", `${config.track_bg_width}`);
        svg_track_bg.setAttributeNS(null, "height", `${config.track_bg_length + (2 * config.track_bg_radius)}`);
        svg_track_bg.setAttributeNS(null, "rx", '5');     // Determines the horizontal corner radius of the rect.
        svg_track_bg.setAttributeNS(null, "ry", '5');     // Determines the vertical corner radius of the rect.
        // svg_track_bg.setAttribute("stroke", `${config.track_bg_color}`);
        svg_track_bg.setAttribute("stroke-width", '0');
        svg_track_bg.setAttribute("fill", `${config.track_bg_color}`);
        // svg_track_bg.setAttribute("stroke-linecap", config.linecap);
        svg_track_bg.setAttribute("class", config.class_track_bg);
        svg_element.appendChild(svg_track_bg);

        console.groupEnd();

    }

    /**
     *
     */
    function draw_track() {
        if (!config.track) return;

        svg_track = document.createElementNS(NS, "rect");
        svg_track.setAttributeNS(null, "x", `${(config.width - config.track_width) / 2}`);
        svg_track.setAttributeNS(null, "y", `${getViewboxY(config.track_offset + position + config.track_radius)}`);
        svg_track.setAttributeNS(null, "width", `${config.track_width}`);
        svg_track.setAttributeNS(null, "height", `${position + (2 *  + config.track_radius)}`);
        svg_track.setAttributeNS(null, "rx", '5');     // Determines the horizontal corner radius of the rect.
        svg_track.setAttributeNS(null, "ry", '5');     // Determines the vertical corner radius of the rect.
        // svg_track.setAttribute("stroke", `${config.track_color_init}`);
        svg_track.setAttribute("stroke-width", '0');
        svg_track.setAttribute("fill", `${config.track_color}`);
        // svg_track.setAttribute("stroke-linecap", config.linecap);
        svg_track.setAttribute("class", config.class_track);
        svg_element.appendChild(svg_track);
    }

    /**
     *
     * @returns {string}
     */
/*
    function getTrackCursor() {
        // let a = sliderToPolarPosition(position);
        let from = getViewboxCoord(a, config.cursor_width);
        let to = getViewboxCoord(a, config.cursor_width + config.cursor_length);
        return `M ${from.x},${from.y} L ${to.x},${to.y}`;
    }
*/

    /**
     *
     */
    function draw_cursor() {

        if (!config.cursor) return;

        svg_cursor = document.createElementNS(NS, "rect");
        svg_cursor.setAttributeNS(null, "x", `${(config.width - config.cursor_width) / 2}`);
        svg_cursor.setAttributeNS(null, "y", `${getViewboxY(config.track_offset + config.cursor_height / 2 + position)}`);
        svg_cursor.setAttributeNS(null, "width", `${config.cursor_width - 1}`);
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
        draw_track_background();
        draw_markers();
        draw_cursor();
        // draw_units();
        draw_track();
        draw_value();
    }

    /**
     *
     */
    function redraw() {

        let p = getTrackPath();
        if (p) {
            if (svg_track) {
                svg_track.setAttributeNS(null, "d", p);
            } else {
                draw_track();
            }
        } else {
            if (svg_track) {
                svg_track.setAttributeNS(null, "d", "");    // we hide the track
            }
        }

        if (!has_changed) {
            has_changed = getValue() !== config.default_value;
            if (has_changed) {
                if (svg_track) {
                    svg_track.setAttribute("stroke", `${config.track_color}`);
                }
            }
        }

        p = getTrackCursor();
        if (p) {
            if (svg_cursor) {
                svg_cursor.setAttributeNS(null, "d", p);
                if (has_changed) {
                    svg_cursor.setAttribute("stroke", `${config.cursor_color}`);
                }
            }
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
