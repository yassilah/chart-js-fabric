import fabricJS, { fabric } from 'fabric'
import Chart, { ChartConfiguration, ChartSize } from 'chart.js'
import { merge } from 'lodash'

const CHART_OPTIONS = 'chart'
const CHART_INSTANCE = '__chart'
const CHART_EVENTS = {
  mousemove: 'mousemove',
  mousedown: 'click',
  mouseout: 'mouseout',
  touchstart: 'touchstart',
  touchmove: 'touchmove'
}
const fabricObject = ((fabricJS as any) as typeof fabric).Object

export class ChartObject extends fabricObject {
  /**
   * Type of an object (rect, circle, path, etc.).
   * Note that this property is meant to be read-only and not meant to be modified.
   * If you modify, certain parts of Fabric (such as JSON loading) won't work correctly.
   *
   * @type {String}
   * @default
   */
  public type: string = 'chart'

  /**
   * List of options to pass into the chart.js instance.
   *
   * @type {Object}
   */
  public [CHART_OPTIONS]: ChartConfiguration = {}

  /**
   * The current chart instance.
   *
   * @type {Chart}
   */
  private [CHART_INSTANCE]: Chart

  /**
   * Set the properties ofthe object.
   *
   * @param {string} key
   * @param {any} value
   */
  public _set(key: string, value: any) {
    if (key === CHART_OPTIONS) {
      console.log(key, value, this[CHART_OPTIONS])
      return this.__setChartConfiguration(value)
    }

    return super._set(key, value)
  }

  /**
   * Set the  chart configuration.
   *
   * @param {Partial<ChartConfiguration>} options
   */
  private __setChartConfiguration(options: Partial<ChartConfiguration>): ChartObject {
    const instance = this[CHART_INSTANCE]

    this[CHART_OPTIONS] = merge({}, this[CHART_OPTIONS], options)

    if (instance) {
      if (options.type && options.type !== instance.config.type) {
        instance.destroy()
        this.__createChart()
        return this
      }
      instance.data = this[CHART_OPTIONS].data || instance.data
      instance.options = this[CHART_OPTIONS].options || instance.options
      this.__chart.update()
    }

    return this
  }

  /**
   * Returns an object representation of an instance
   *
   * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
   * @return {Object} Object representation of an instance
   */
  public toObject(propertiesToInclude: string[] = []) {
    return super.toObject(propertiesToInclude.concat('ChartConfiguration'))
  }

  /**
   * Set the chart instance size.
   *
   * @return {void}
   */
  private __setChartSize() {
    const canvas = this[CHART_INSTANCE].canvas!
    canvas.width = this.width! * this.scaleX! * window.devicePixelRatio
    canvas.height = this.height! * this.scaleY! * window.devicePixelRatio
    this[CHART_INSTANCE].resize()
  }

  /**
   * The default mandatory options set to the chart instance.
   *
   * @return {Object}
   */
  private __defaultChartConfiguration() {
    return {
      plugins: [],
      options: {
        responsive: false,
        maintainAspectRatio: false,
        onResize: (newSize: ChartSize) => {
          this[CHART_OPTIONS].options?.onResize?.call(this[CHART_INSTANCE], newSize)
          this.dirty = true
          this.canvas?.requestRenderAll()
        },
        animation: {
          onProgress: () => {
            this[CHART_OPTIONS].options?.animation?.onProgress?.call(
              this[CHART_INSTANCE],
              this[CHART_INSTANCE]
            )
            this.dirty = true
            this.canvas?.requestRenderAll()
          }
        }
      }
    }
  }

  /**
   * CHange the default "getBoundingClientRect" method of the
   * HTMCanvasElement to reflect the bounding rect of the
   * current fabric.Object.
   *
   * @return {DOMRect}
   */
  private __getChartBoundingClientRect() {
    return {
      bottom: this.top! + this.getScaledHeight(),
      height: this.getScaledHeight(),
      left: this.left,
      right: this.left! + this.getScaledWidth(),
      top: this.top,
      width: this.getScaledWidth(),
      x: this.left! + this.getScaledWidth() / 2,
      y: this.top! + this.getScaledHeight() / 2
    } as DOMRect
  }

  /**
   * Cheng the default current style of the
   * HTMLCanvasElement to remove all paddings.
   *
   * @return {Partial<CSSStyleDeclaration>}
   */
  private __getChartCurrentStyle() {
    return {
      'padding-left': 0,
      'padding-right': 0,
      'padding-top': 0,
      'padding-bottom': 0
    } as Partial<CSSStyleDeclaration>
  }

  /**
   * Create the chart canvas.
   *
   * @return {HTMLCanvasElement}
   */
  private __createChartCanvas() {
    const canvas = document.createElement('canvas')
    canvas.width = this.width! * this.scaleX!
    canvas.height = this.height! * this.scaleY!

    Object.defineProperty(canvas, 'clientWidth', {
      get: () => canvas.width / window.devicePixelRatio
    })

    Object.defineProperty(canvas, 'clientHeight', {
      get: () => canvas.height / window.devicePixelRatio
    })

    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: this.__getChartBoundingClientRect.bind(this)
    })

    Object.defineProperty(canvas, 'currentStyle', {
      value: this.__getChartCurrentStyle()
    })

    return canvas
  }

  /**
   * Bind the chart events with the current fabric.Objecct
   * events.
   *
   * @return {void}
   */
  private __bindChartEvents() {
    for (const name in CHART_EVENTS) {
      const event = name as keyof typeof CHART_EVENTS
      this.on(event, e => {
        if (this.canvas && this[CHART_INSTANCE].canvas) {
          const { x, y } = this.toLocalPoint(
            this.canvas.getPointer(e.e) as fabric.Point,
            'left',
            'top'
          )

          this[CHART_INSTANCE].canvas!.dispatchEvent(
            new MouseEvent(CHART_EVENTS[event], {
              clientX: this.left! + x,
              clientY: this.top! + y
            })
          )
        }
      })
    }
  }

  /**
   * Ccreate the chart instance.
   *
   * @return {Chart}
   */
  private __createChart() {
    const options = merge({}, this[CHART_OPTIONS], this.__defaultChartConfiguration())

    this[CHART_INSTANCE] = new Chart(this.__createChartCanvas(), options)

    return this[CHART_INSTANCE]
  }

  /**
   * Initialize the object, create the chart and bind events.
   *
   * @param {fabric.IChartConfiguration} options
   * @return {fabric.Chart}
   */
  public initialize(options?: fabric.IChartConfiguration) {
    super.initialize(options)
    this.__createChart()
    this.__bindChartEvents()
    this.on('scaling', this.__setChartSize.bind(this))

    return this
  }

  /**
   * Execute the drawing operation for an object on a specified context
   *
   * @param {CanvasRenderingContext2D} ctx Context to render on
   */
  public drawObject(ctx: CanvasRenderingContext2D) {
    this._render(ctx)
  }

  /**
   * function that actually render something on the context.
   * empty here to allow Obects to work on tests to benchmark fabric functionalites
   * not related to rendering
   *
   * @param {CanvasRenderingContext2D} ctx Context to render on
   */
  public _render(ctx: CanvasRenderingContext2D) {
    if (this[CHART_INSTANCE]) {
      ctx.drawImage(
        this[CHART_INSTANCE].canvas!,
        -this.width! / 2,
        -this.height! / 2,
        this.width!,
        this.height!
      )
    }
  }
}

declare module 'fabric' {
  namespace fabric {
    class Chart extends ChartObject {
      constructor(options?: IChartConfiguration)
    }
    interface IChartConfiguration extends IObjectOptions {
      [CHART_OPTIONS]: ChartConfiguration
    }
  }
}

const klass = (fabricJS as any).util.createClass(ChartObject)
klass.type = 'chart'
Object.defineProperty(fabricJS, 'Chart', {
  value: klass
})
