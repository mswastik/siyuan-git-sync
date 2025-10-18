/**
 * Basic SiYuan Plugin Types
 */

declare module "siyuan" {
    export interface IPluginData {
        [key: string]: any;
    }

    export interface ITopBarIconOptions {
        icon: string;
        title: string;
        position?: "right" | "left";
        callback?: () => void;
    }

    export interface ITabOptions {
        type: string;
        init?: () => void;
        destroy?: () => void;
        resize?: () => void;
        update?: () => void;
    }

    export class Plugin {
        public i18n: any;
        public data: IPluginData;
        public name: string;

        constructor();

        /**
         * Plugin loaded
         */
        onload(): void;

        /**
         * Plugin unloaded
         */
        onunload(): void;

        /**
         * Load plugin data
         */
        loadData(filename: string): Promise<string>;

        /**
         * Save plugin data
         */
        saveData(filename: string, content: string): Promise<void>;

        /**
         * Add top bar icon
         */
        addTopBar(options: ITopBarIconOptions): HTMLElement;

        /**
         * Add tab
         */
        addTab(options: ITabOptions): void;
    }

    /**
     * Show message
     */
    export function showMessage(
        message: string,
        timeout?: number,
        type?: "info" | "error"
    ): void;

    /**
     * Confirm dialog
     */
    export function confirm(
        title: string,
        text: string,
        confirmCallback?: () => void,
        cancelCallback?: () => void
    ): void;
}