﻿import { Viewer, ProductType, State } from '../viewer';
import { Session } from './session';
import { stat } from 'fs';

/**
 * This class is a convenience wrapper around the viewer which provides
 * undo/redo operations for all viewer functions
 * @name ViewerSession
 * @constructor
 * @classdesc This class allows to manage state of selection and visibility in undo/redo session
 *
 * @param {Viewer} viewer viewer to operate on
 */
export class ViewerSession extends Session {

    constructor(private viewer: Viewer) {
        super();
    }

    private _selection: { [modelId: number]: { [id: number]: State; }; } = {};

    /**
     * Current selection as a read-only list of product and model ids
     * @member {Array<{ id: number, modelId: number }>} ViewerSession#selection 
     */
    public get selection(): Array<{ id: number, modelId: number }> {
        const result: Array<{ id: number, modelId: number }> = [];
        Object.getOwnPropertyNames(this._selection).forEach(name => {
            const modelId = parseInt(name);
            Object.getOwnPropertyNames(this._selection[modelId]).forEach(idString => {
                const id = parseInt(idString);
                // get actual current state
                var state = this.viewer.getState(id, modelId);
                if (state != State.HIGHLIGHTED) {
                    delete this._selection[name][idString];
                } else {
                    result.push({ id, modelId });
                }
            });
        });
        return result;
    }

    private getSelectionClone(): { [modelId: number]: { [id: number]: State; }; } {
        var result: { [modelId: number]: { [id: number]: State; }; } = {};
        Object.getOwnPropertyNames(this._selection).forEach(name => {
            const modelId = parseInt(name);
            if (!result[modelId]) {
                result[modelId] = {};
            }
            Object.getOwnPropertyNames(this._selection[modelId]).forEach(idString => {
                const id = parseInt(idString);
                result[modelId][id] = this._selection[modelId][id];
            });
        });
        return result;
    }

    private getProductsOfType(type: ProductType | ProductType[]): Array<{ id: number, modelId: number }> {
        var result = [];
        if (Array.isArray(type)) {
            type.forEach(typeId => {
                this.viewer.ModelIds.forEach(modelId => {
                    this.viewer.getProductsOfType(typeId, modelId).forEach(id => {
                        result.push({ id, modelId });
                    });
                });
            });
        } else {
            this.viewer.ModelIds.forEach(modelId => {
                this.viewer.getProductsOfType(type, modelId).forEach(id => {
                    result.push({ id, modelId });
                });
            });
        }
        return result;
    }

    /**
    * Selects all instances of the specified type or types
    * @function ViewerSession.selectType
    * @param {ProductType | ProductType[]} type - Type or array of types
    * @param {boolean} clear - Defines wether the selection should be cleared or added
    */
    public selectType(type: ProductType | ProductType[], clear: boolean) {
        const ids = this.getProductsOfType(type);
        this.select(ids, clear);
    }

    /**
    * Selects all instances defined as a list of objects containing id and modelId
    * @function ViewerSession.select
    * @param {Array<{ id: number, modelId: number }>} products - Product and model IDs
    * @param {boolean} clear - Defines wether the selection should be cleared or added
    * @fires ViewerSession#selection
    */
    public select(products: Array<{ id: number, modelId: number }>, clear: boolean): void {
        // copy current selection
        const oldSelection = this.getSelectionClone();
        let newSelection: { [modelId: number]: { [id: number]: State; }; } = clear ? {} : this.getSelectionClone();
        products.forEach(product => {
            const id = product.id;
            const modelId = product.modelId;
            const state = this.viewer.getState(id, modelId);

            if (!newSelection[modelId]) {
                newSelection[modelId] = {};
            }

            if (!newSelection[modelId][id]) {
                newSelection[modelId][id] = state;
            }
        });

        const doAction = () => {
            Object.getOwnPropertyNames(oldSelection).forEach(name => {
                const modelId = parseInt(name);
                Object.getOwnPropertyNames(oldSelection[modelId]).forEach(idString => {
                    const id = parseInt(idString);
                    const state = oldSelection[modelId][id];
                    if (!newSelection[modelId] || !newSelection[modelId][id]) {
                        this.viewer.setState(state, [id], modelId);
                    }
                });
            });
            Object.getOwnPropertyNames(newSelection).forEach(name => {
                const modelId = parseInt(name);
                Object.getOwnPropertyNames(newSelection[modelId]).forEach(idString => {
                    const id = parseInt(idString);
                    this.viewer.setState(State.HIGHLIGHTED, [id], modelId);
                });
            });
            this._selection = newSelection;
            /**
             * Occurs when selection changes
             * 
             * @event VieweSession.selection
             * @type {object}
             * @param {Number} id - product ID
             * @param {Number} modelId - model ID
             * 
            */
            super.fire('selection', this.selection );
        };
        const undoAction = () => {
            Object.getOwnPropertyNames(newSelection).forEach(name => {
                const modelId = parseInt(name);
                Object.getOwnPropertyNames(newSelection[modelId]).forEach(idString => {
                    const id = parseInt(idString);
                    const state = newSelection[modelId][id];
                    if (!oldSelection[modelId] || !oldSelection[modelId][id]) {
                        this.viewer.setState(state, [id], modelId);
                    }
                });
            });
            Object.getOwnPropertyNames(oldSelection).forEach(name => {
                const modelId = parseInt(name);
                Object.getOwnPropertyNames(oldSelection[modelId]).forEach(idString => {
                    const id = parseInt(idString);
                    this.viewer.setState(State.HIGHLIGHTED, [id], modelId);
                });
            });
            this._selection = oldSelection;
            super.fire('selection', this.selection);
        };
        super.do(doAction, undoAction);
    }

    private _hidden: { [modelId: number]: { [id: number]: State; }; } = {};

     /**
     * Current hidden products as a read-only list of product and model ids
     * @member {Array<{ id: number, modelId: number }>} ViewerSession#hidden 
     */
    public get hidden(): Array<{ id: number, modelId: number }> {
        const result: Array<{ id: number, modelId: number }> = [];
        Object.getOwnPropertyNames(this._hidden).forEach(name => {
            const modelId = parseInt(name);
            Object.getOwnPropertyNames(this._hidden[modelId]).forEach(idString => {
                const id = parseInt(idString);
                // get actual current state
                var state = this.viewer.getState(id, modelId);
                if (state != State.HIDDEN) {
                    delete this._hidden[name][idString];
                } else {
                    result.push({ id, modelId });
                }
            });
        });
        return result;
    }

    /**
    * Hides all instances of the specified type or types
    * @function ViewerSession.hideType
    * @param {ProductType | ProductType[]} type - Type or array of types
    * @param {boolean} clear - Defines wether the selection should be cleared or added
    * @fires ViewerSession#hide
    */
    public hideType(type: ProductType | ProductType[]) {
        var ids = this.getProductsOfType(type);
        this.hide(ids);
    }

    /**
    * Hides all instances defined as a list of objects containing id and modelId
    * @function ViewerSession.hide
    * @param {Array<{ id: number, modelId: number }>} products - Product and model IDs
    * @fires ViewerSession#hide
    */
    public hide(products: Array<{ id: number, modelId: number }>): void {
        let toHide: Array<{ id: number, modelId: number, state?: State }> = [];

        products.forEach(product => {
            const id = product.id;
            const modelId = product.modelId;
            const state = this.viewer.getState(id, modelId);

            if (!this._hidden[modelId]) {
                this._hidden[modelId] = {};
            }

            // ignore already hidden and highlighted
            if (state == State.HIDDEN || state == State.HIGHLIGHTED) {
                return;
            }

            const p = Object.assign({ state }, product);
            toHide.push(p);
        });

        const doAction = () => {
            toHide.forEach(product => {
                const id = product.id;
                const modelId = product.modelId;
                const state = product.state;
                this._hidden[modelId][id] = state;
                this.viewer.setState(State.HIDDEN, [id], modelId);
            });
            /**
             * Occurs when selection changes
             * 
             * @event VieweSession#hide
             * @type {object[]}
             * @param {Number} id - product ID
             * @param {Number} modelId - model ID
             * 
            */
            super.fire('hide', toHide.slice(0));
        };
        const undoAction = () => {
            toHide.forEach(product => {
                const id = product.id;
                const modelId = product.modelId;
                const state = product.state;
                this.viewer.setState(state, [id], modelId);
                delete this._hidden[modelId][id];
            });
            super.fire('show', toHide.slice(0));
        };
        super.do(doAction, undoAction);
    }

    /**
    * Shows all instances of the specified type or types
    * @function ViewerSession.showType
    * @param {ProductType | ProductType[]} type - Type or array of types
    * @param {boolean} clear - Defines wether the selection should be cleared or added
    * @fires ViewerSession#show
    */
    public showType(type: ProductType | ProductType[]) {
        var ids = this.getProductsOfType(type);
        this.show(ids);
    }

    /**
    * Shows all instances defined as a list of objects containing id and modelId
    * @function ViewerSession.show
    * @param {Array<{ id: number, modelId: number }>} products - Product and model IDs
    * @fires ViewerSession#show
    */
    public show(products: Array<{ id: number, modelId: number }>): void {
        // copy current hidden object
        let toShow: Array<{ id: number, modelId: number, state: State }> = [];

        // filter only to products which are not visible
        products.forEach(product => {
            const id = product.id;
            const modelId = product.modelId;

            if (!this._hidden[modelId]) {
                this._hidden[modelId] = {};
            }

            let state = this.viewer.getState(id, modelId);
            if (state != State.HIDDEN) {
                return;
            }

            const pastState = this._hidden[modelId][id];
            if (pastState)
                state = pastState;

            if (state === State.HIDDEN) {
                state = State.UNDEFINED;
            }

            toShow.push(Object.assign({ state }, product));
        });

        const doAction = () => {
            toShow.forEach(product => {
                const id = product.id;
                const modelId = product.modelId;
                const state = product.state;
                delete this._hidden[modelId][id];
                this.viewer.setState(state, [id], modelId);
            });
             /**
             * Occurs when selection changes
             * 
             * @event VieweSession#show
             * @type {object[]}
             * @param {Number} id - product ID
             * @param {Number} modelId - model ID
             * 
            */
            super.fire('show', toShow );
        };
        const undoAction = () => {
            toShow.forEach(product => {
                const id = product.id;
                const modelId = product.modelId;
                this._hidden[modelId][id] = this.viewer.getState(id, modelId);
                this.viewer.setState(State.HIDDEN, [id], modelId);
            });
            super.fire('hide', toShow);
        };
        super.do(doAction, undoAction);
    }

     /**
    * Clips the model
    * @function ViewerSession.clip
    * @param {number[]} [point] - Point of clipping
    * @param {number[]} [normal] - Normal to the clipping plane
    * @fires ViewerSession#clip
    */
    public clip(point?: number[], normal?: number[]) {
        var plane = this.viewer.clippingPlaneA.slice(0);
        var doAction = () => {
            this.viewer.clip(point, normal);
            super.fire('clip', this.viewer.clippingPlaneA.slice(0));
        };
        var undoAction = () => {
            this.viewer.clippingPlaneA = plane;
            super.fire('clip', plane);
        };
        super.do(doAction, undoAction);
    }

    /**
    * Unclips the model
    * @function ViewerSession.unclip
    * @fires ViewerSession#clip
    */
    public unclip(): void {
        var plane = this.viewer.clippingPlaneA.slice(0);
        var doAction = () => {
            this.viewer.unclip();
            super.fire('clip', this.viewer.clippingPlaneA.slice(0));
        };
        var undoAction = () => {
            this.viewer.clippingPlaneA = plane;
            super.fire('clip', this.viewer.clippingPlaneA.slice(0));
        };
        super.do(doAction, undoAction);
    }

    //public setState(state: State, target: number | number[], modelId?: number) {
    //    if (typeof (modelId) === 'undefined') {
    //        modelId = 0;
    //    }
    //    var stateName = State[state];
    //    var old = this.viewer.getModelState(modelId);
    //    var doAction = () => {
    //        this.viewer.setState(state, target, modelId);
    //    };
    //    var undoAction = () => {
    //        this.viewer.restoreModelState(modelId, old);
    //    };
    //    super.do(doAction, undoAction);
    //}

    //public setStyle(style: number, target: number | number[], modelId?: number) {
    //    if (typeof (modelId) === 'undefined') {
    //        modelId = 0;
    //    }
    //    var old = this.viewer.getModelState(modelId);
    //    var doAction = () => {
    //        this.viewer.setStyle(style, target, modelId);
    //    };
    //    var undoAction = () => {
    //        this.viewer.restoreModelState(modelId, old);
    //    };
    //    super.do(doAction, undoAction);
    //}

    private currentZoom: { id: number, modelId: number } = null;

    /**
    * Zooms to specified product or to full extent if no argument is provided
    * @function ViewerSession.zoom
    * @param {number} [id] - Product ID
    * @param {number} [modelId] - Model ID
    * @fires ViewerSession#zoom
    */
    public zoomTo(id?: number, modelId?: number) {
        var oldMv = new Float32Array(this.viewer.mvMatrix);
        var oldZoom = this.currentZoom != null ? Object.assign({}, this.currentZoom) : null;
        var newZoom = id != null ? { id, modelId } : null;
        var doAction = () => {
            this.viewer.zoomTo(id, modelId);
            this.currentZoom = newZoom;
            super.fire('zoom', newZoom);
        };
        var undoAction = () => {
            this.viewer.mvMatrix = oldMv;
            this.currentZoom = oldZoom;
            super.fire('zoom', oldZoom);
        };
        super.do(doAction, undoAction);
    }

    //public setCameraPosition(coordinates: number[]) {
    //    var oldMv = new Float32Array(this.viewer.mvMatrix);
    //    var doAction = () => {
    //        this.viewer.setCameraPosition(coordinates);
    //    };
    //    var undoAction = () => {
    //        this.viewer.mvMatrix = oldMv;
    //    };
    //    super.do(doAction, undoAction);
    //}

    //public setCameraTarget(prodId?: number, modelId?: number) {
    //    var oldDistance = this.viewer._distance;
    //    var oldOrigin = this.viewer._origin.slice(0);
    //    var doAction = () => {
    //        this.viewer.setCameraTarget(prodId, modelId);
    //    };
    //    var undoAction = () => {
    //        this.viewer._origin = oldOrigin;
    //        this.viewer._distance = oldDistance;
    //    };
    //    super.do(doAction, undoAction);
    //}

    /**
    * Stops one model
    * @function ViewerSession.stopModel
    * @param {number} [id] - Model ID
    * @fires ViewerSession#modelsChanged
    */
    public stopModel(id?: number) {
        var doAction = () => {
            this.viewer.stop(id);
            super.fire('modelsChanged', this.viewer.ModelIdsOn)
        };
        var undoAction = () => {
            this.viewer.start(id);
            super.fire('modelsChanged', this.viewer.ModelIdsOn)
        };
        super.do(doAction, undoAction);
    }

    /**
    * Starts one model
    * @function ViewerSession.stopModel
    * @param {number} [id] - Model ID
    * @fires ViewerSession#modelsChanged
    */
    public startModel(id?: number) {
        var doAction = () => {
            this.viewer.start(id);
            super.fire('modelsChanged', this.viewer.ModelIdsOn)
        };
        var undoAction = () => {
            this.viewer.stop(id);
            super.fire('modelsChanged', this.viewer.ModelIdsOn)
        };
        super.do(doAction, undoAction);
    }
}

class Snapshot {
    private mvMatrix: Float32Array;
    private states: { [id: number]: Array<Array<number>>; } = {};
    private clippingPlaneA: number[];
    private clippingPlaneB: number[];
    private modelsOn: number[];
    private modelsOff: number[];


    constructor(private viewer: Viewer) {
        //camera view
        this.mvMatrix = new Float32Array(viewer.mvMatrix);

        //models state
        let ids = viewer.ModelIds;
        ids.forEach((id, i, a) => {
            this.states[id] = viewer.getModelState(id);
        });

        //clipping planes
        this.clippingPlaneA = viewer.clippingPlaneA.slice(0);
        this.clippingPlaneB = viewer.clippingPlaneB.slice(0);

        //models stopped and active
        this.modelsOn = viewer.ModelIdsOn;
        this.modelsOff = viewer.ModelIdsOff;
    }

    public Restore() {
        let v = this.viewer;

        //camera view
        v.mvMatrix = this.mvMatrix;

        //models state
        for (let id in this.states) {
            let modelId = new Number(id).valueOf();
            let state = this.states[id];
            v.restoreModelState(modelId, state);
        }

        //clipping planes
        v.clippingPlaneA = this.clippingPlaneA;
        v.clippingPlaneB = this.clippingPlaneB;

        //models stopped and active
        this.modelsOn.forEach((id) => { v.start(id); });
        this.modelsOff.forEach((id) => { v.stop(id); });
    }
}