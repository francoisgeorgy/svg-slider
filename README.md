# svg-slider

A flexible and customizable slider for your web applications.

## Usage

Check the `demo.html` file for examples.

    .slider {
        width: 100px;
    }

    <svg class="slider" id="slider"></svg>

#### Without ES6 module support:

    <script src="dist/svg-slider.min.js"></script>
    <script>
        var Slider = svgSlider.default;
        var s = new Slider('#slider', { /* config... */ });   
    </script>

#### With ES6 module support:

    <script type="module">
        import Slider from './index.js';
        const s = new Slider('#slider', { /* config... */ });        
    </script>

### change the value:

    s.value = 42;
    
### listen to the change events:

    document.getElementById("slider").addEventListener("change", function(event) {
        let [slider_id, slider_value] = [event.target.id, event.detail];
    });    

## Usage with React


Quick example for a svg-knob and a linked div displaying the value transmitted through the knob's onChange event.

### Simple `SliderContainer` component (2 files):

`components/SliderContainer/index.jsx` :

    import React, { Component } from 'react';
    import SliderComponent from "./SliderComponent";
    
    function Value(props) {
        return <div className="value">{props.value}</div>;
    }
    
    class SliderContainer extends Component {
    
        state = { value: 0 };
    
        handleChange = e => this.setState({value: e.detail});
    
        render() {
            return (
                <div className="slider">
                    <SliderComponent onChange={this.handleChange} />
                    <Value value={this.state.value} />
                </div>
            );
        }
    }
    
    export default SliderContainer

`components/SliderContainer/SliderComponent.jsx` :

    import React, { Component } from 'react';
    import PropTypes from 'prop-types';
    import SvgSlider from 'svg-slider';
    
    class SliderComponent extends Component {
    
        handleChange = e => {
            if (this.props.onChange) this.props.onChange(e);
        };
    
        componentDidMount() {
            this.k = new SvgSlider(this.dom);
            this.dom.addEventListener("change", this.handleChange);
        }
    
        // Not really necessary, but will slightly improve the rendering performance.
        shouldComponentUpdate() {
            return this.k === null;
        }
    
        render() {
            return (
                <svg ref={elem => this.dom = elem} />
            );
        }
    }
    
    // https://reactjs.org/docs/typechecking-with-proptypes.html
    SliderComponent.propTypes = {
        onChange: PropTypes.func
    };
    
    export default SliderComponent;

### React App:

`App.js` :

    import React, {Component} from 'react';
    import './App.css';
    import SliderContainer from "./components/SliderContainer/index";

    class App extends Component {
        render() {
            return (
                <div>
                    <SliderContainer />
                </div>
            );
        }
    }

    export default App;

`App.css`:
    
    .slider {
        width: 40px;
    }
    
    .slider .value {
        text-align: center;
    }


# Options

    let defaults = {
        // User configurable properties. The colors are defined in the 'palettes', later on.

        width: 20,

        // background:
        bg_width: 20,
        bg_border_width: 1,

        // markers:
        markers: 4,                  // number of markers; 0 or false to disable
        markers_length: 18,
        markers_width: 1,

        // track background:
        track_bg_offset: 5,
        track_bg_length: 90,
        track_bg_width: 8,
        track_bg_radius: 3,
        track_bg_border_width: 2,

        // track:
        track_offset: 5,
        track_length: 90,
        track_width: 6,
        track_radius: 3,

        // cursor
        cursor_width: 14,
        cursor_height: 6,
        cursor_border_width: 0,
        cursor_radius: 2,

        // value range
        default_value: 0,
        initial_value: 0,
        value_min: 0.0,
        value_max: 100.0,
        value_resolution: 1,        // null means ignore

        // appearance:
        palette: 'light',
        bg: false,
        track_bg: true,
        track: true,
        cursor: true,
        // CSS class names
        linecap: 'butt',                    // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-linecap
        value_text: true,
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

        // mouse wheel support:
        mouse_wheel_acceleration: 1,

        // callback function
        onchange: null                      // provides an alternative to the 'change' event
    };

    light: {
        bg_color: '#E0E0E0',
        bg_border_color: '#BDBDBD',
        track_bg_color: '#D0D0D0',
        track_bg_border_color: '#FFFFFF',
        track_color_init: '#64B5F6',
        track_color: '#42A5F5',
        cursor_color_init: '#64B5F6',
        cursor_color: '#3CA0F0',
        markers_color: '#AAAAAA',
        font_color: '#424242',
    },
    light2: {
        bg_color: '#B1DAEE',
        bg_border_color: '#569DC0',
        track_bg_color: '#B1DAEE',
        track_bg_border_color: '#888',
        track_color_init: '#569DC0',
        track_color: '#1D6D93',
        cursor_color_init: '#569DC0',
        cursor_color: '#1D6D93',
        markers_color: '#3680A4',
        font_color: '#1D6D93',
    },
    dark: {
        bg: false,
        track_bg: true,
        track: true,
        cursor: true,
        bg_color: '#333',
        bg_border_color: '#888',
        track_bg_color: '#555',
        track_bg_border_color: '#373738',
        track_color_init: '#999',
        track_color: '#bbb',
        cursor_color_init: '#999',
        cursor_color: '#d3d347',
        markers_color: '#999',
        font_color: '#FFEA00',
    }


## TODO

- horizontal, vertical, free angle
- snap to zero
- log scale
    - https://www.kvraudio.com/forum/viewtopic.php?t=348751
    - http://education.lenardaudio.com/en/09_mix_3.html
- steps (predefined positions)
- display value along cursor
- contextual menu
- keyboard support


# MISC

Add ES5 support: 

    yarn add --dev babel-loader babel-core
    yarn add --dev babel-preset-es2015
    
create `.babelrc` with:
    
    {
        "presets": ["es2015"]
    }

add in webpack config:

    module: {
        loaders: [{
            test: /\.js$/,
            exclude: /node_modules/,
            loader: "babel-loader"
        }]
    }




## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

