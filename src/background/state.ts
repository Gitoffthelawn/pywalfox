import {
  IPywalHash,
  IPywalColors,
  ICustomColors,
  ITheme,
  IUserTheme,
  IBrowserTheme,
  IThemeTemplate,
  ITimeIntervalEndpoint,
  IExtensionState,
  IExtensionOptions,
  IOptionSetData,
  ITemplateThemeMode,
  CSSTargets,
  ThemeModes,
} from '@definitions';

import { STATE_VERSION, DEFAULT_CSS_FONT_SIZE } from '@config/general';
import { DEFAULT_THEME_DARK, DEFAULT_THEME_LIGHT } from '@config/default-themes';

import merge from 'just-merge';

export default class State {
  private initialState: IExtensionState;
  public currentState: IExtensionState;

  constructor() {
    this.initialState = {
      version: 0.0,
      stateVersion: 0.0,
      connected: false,
      updateMuted: false,
      mode: ThemeModes.Dark,
      isDay: false,
      isApplied: false,
      pywalColors: null,
      pywalHash: null,
      generatedTheme: null,
      globalTemplates: {
        [ThemeModes.Light]: DEFAULT_THEME_LIGHT,
        [ThemeModes.Dark]: DEFAULT_THEME_DARK,
      },
      userThemes: {},
      options: {
        userChrome: false,
        userContent: false,
        fontSize: DEFAULT_CSS_FONT_SIZE,
        duckduckgo: false,
        darkreader: false,
        fetchOnStartup: false,
        intervalStart: { hour: 10, minute: 0, stringFormat: '10:00' },
        intervalEnd: { hour: 19, minute: 0, stringFormat: '19:00' },
      },
    };

    browser.storage.onChanged.addListener(this.onStateChanged.bind(this));
  }

  private onStateChanged(changes: browser.storage.StorageChange, areaName: string) {
    console.debug(`[${areaName}] State change:`, changes);
  }

  private async set(newState: {}) {
    Object.assign(this.currentState, newState);
    await browser.storage.local.set(newState);
  }

  private updateGlobalTemplate(data: Partial<IThemeTemplate>) {
    const currentThemeMode = this.getTemplateThemeMode();
    const globalTemplate = this.currentState.globalTemplates[currentThemeMode] || {};
    const updatedTemplate = merge({}, globalTemplate, data);

    return this.set({
      globalTemplates: {
        [currentThemeMode]: updatedTemplate,
      },
    });
  }

  private updateGeneratedTheme(data: Partial<ITheme>) {
    const generatedTheme = this.currentState.generatedTheme || {};
    const updatedTheme = merge({}, generatedTheme, data);

    return this.set({
      generatedTheme: updatedTheme,
    });
  }

  private updateGeneratedTemplate(data: Partial<IThemeTemplate>) {
    const generatedTheme = this.currentState.generatedTheme;

    if (!generatedTheme) {
      return;
    }

    const updatedTemplate = merge({}, generatedTheme.template, data);
    return this.updateGeneratedTheme({ template: updatedTemplate });
  }

  private updateCurrentTheme(data: Partial<IUserTheme>) {
    const pywalHash = this.getPywalHash();
    const currentThemeMode = this.getTemplateThemeMode();

    if (pywalHash === null) {
      return;
    }

    // TODO: This merge is broken
    const currentTheme = this.currentState.userThemes[pywalHash] || {};
    const updatedTheme = merge({}, currentTheme, {
      [currentThemeMode]: data
    });

    return this.set({
      userThemes: {
        ...this.currentState.userThemes,
        [pywalHash]: updatedTheme,
      },
    });
  }

  private updateOptions(option: Partial<IExtensionOptions>) {
    const updatedOptions = merge({}, this.currentState.options, option);

    return this.set({
      options: updatedOptions,
    });
  }

  public getInitialData() {
    return {
      debuggingInfo: this.getDebuggingInfo(),
      isApplied: this.getApplied(),
      pywalColors: this.getPywalColors(),
      template: this.getGeneratedTemplate(),
      userTheme: this.getUserTheme(),
      themeMode: this.getThemeMode(),
      templateThemeMode: this.getTemplateThemeMode(),
      options: this.getOptionsData(),
    };
  }

  public getDebuggingInfo() {
    return {
      version: this.getVersion(),
      connected: this.getConnected(),
    };
  }

  public getApplied() {
    return this.currentState.isApplied;
  }

  public getVersion() {
    return this.currentState.version;
  }

  public getConnected() {
    return this.currentState.connected;
  }

  public getUpdateMuted() {
    return this.currentState.updateMuted;
  }

  public getGeneratedTemplate() {
    const { generatedTheme } = this.currentState;

    if (!generatedTheme) {
      return this.currentState.globalTemplates[this.getTemplateThemeMode()];
    }

    return generatedTheme.template;
  }

  public getIsDay() {
    return this.currentState.isDay;
  }

  public getThemeMode() {
    return this.currentState.mode;
  }

  public getTemplateThemeMode() {
    let themeMode = this.getThemeMode();

    if (themeMode === ThemeModes.Auto) {
      themeMode = this.getIsDay() ? ThemeModes.Light : ThemeModes.Dark;
    }

    return <ITemplateThemeMode>themeMode;
  }

  public getPywalColors() {
    return this.currentState.pywalColors;
  }

  public getPywalHash() {
    return this.currentState.pywalHash;
  }

  public getGlobalTemplate() {
    const currentThemeMode = this.getTemplateThemeMode();
    const { globalTemplates } = this.currentState;

    if (!globalTemplates) {
      return currentThemeMode === ThemeModes.Dark ? DEFAULT_THEME_DARK : DEFAULT_THEME_LIGHT;
    }

    return globalTemplates[currentThemeMode];
  }

  public getGeneratedTheme() {
    return this.currentState.generatedTheme;
  }

  public getDuckduckgoEnabled() {
    return this.currentState.options.duckduckgo;
  }

  public getDarkreaderEnabled() {
    return this.currentState.options.darkreader;
  }

  public getFetchOnStartupEnabled() {
    return this.currentState.options.fetchOnStartup;
  }

  public getCssFontSize() {
    return this.currentState.options.fontSize;
  }

  public getCssEnabled(target: CSSTargets) {
    return this.currentState.options[target];
  }

  public getInterval() {
    const { intervalStart, intervalEnd } = this.currentState.options;
    return {
      intervalStart,
      intervalEnd,
    };
  }

  public getOptionsData() {
    const data: IOptionSetData[] = [];

    Object.keys(this.currentState.options).forEach((key) => {
      const value = this.currentState.options[key];

      if (typeof value === 'boolean') {
        data.push({ option: key, enabled: value });
      } else {
        data.push({ option: key, enabled: true, value });
      }
    });

    return data;
  }

  public getUserTheme() {
    const pywalHash = this.getPywalHash();
    const savedTheme = this.currentState.userThemes[pywalHash];
    const currentThemeMode = this.getTemplateThemeMode();

    if (!pywalHash || !savedTheme || !savedTheme[currentThemeMode]) {
      return {};
    }

    return savedTheme[currentThemeMode];
  }

  public setGlobalTemplate(data: Partial<IThemeTemplate>) {
    return this.updateGlobalTemplate(data);
  }

  public setGeneratedTemplate(template: Partial<IThemeTemplate>) {
    return this.updateGeneratedTemplate(template);
  }

  public setBrowserTheme(browser: IBrowserTheme) {
    return this.updateGeneratedTheme({ browser });
  }

  public setUserTemplate(userTemplate: Partial<IThemeTemplate>) {
    return this.updateCurrentTheme({ userTemplate });
  }

  public setCustomColors(customColors: ICustomColors) {
    return this.updateCurrentTheme({ customColors });
  }

  public setVersion(version: number) {
    return this.set({ version });
  }

  public setConnected(connected: boolean) {
    return this.set({ connected });
  }

  public setUpdateMuted(muted: boolean) {
    return this.set({ updateMuted: muted });
  }

  public setApplied(isApplied: boolean) {
    return this.set({ isApplied });
  }

  public setPywalColors(pywalColors: IPywalColors) {
    return this.set({ pywalColors });
  }

  public setPywalHash(pywalHash: IPywalHash) {
    return this.set({ pywalHash });
  }

  public setThemeMode(mode: ThemeModes) {
    return this.set({ mode });
  }

  public setIsDay(isDay: boolean) {
    return this.set({ isDay });
  }

  public setGeneratedTheme(generatedTheme: ITheme) {
    return this.set({ generatedTheme });
  }

  public setDuckduckgoEnabled(duckduckgo: boolean) {
    return this.updateOptions({ duckduckgo });
  }

  public setDarkreaderEnabled(darkreader: boolean) {
    return this.updateOptions({ darkreader });
  }

  public setFetchOnStartupEnabled(fetchOnStartup: boolean) {
    return this.updateOptions({ fetchOnStartup });
  }

  public setIntervalStart(intervalStart: ITimeIntervalEndpoint) {
    return this.updateOptions({ intervalStart });
  }

  public setIntervalEnd(intervalEnd: ITimeIntervalEndpoint) {
    return this.updateOptions({ intervalEnd });
  }

  public setCssEnabled(target: CSSTargets, enabled: boolean) {
    return this.updateOptions({ [target]: enabled });
  }

  public setCssFontSize(fontSize: number) {
    return this.updateOptions({ fontSize });
  }

  public resetCustomColors() {
    return this.setCustomColors(null);
  }

  public resetGeneratedTheme() {
    return this.setGeneratedTheme(null);
  }

  public async load() {
    this.currentState = await browser.storage.local.get(this.initialState) as IExtensionState;

    const currentStateVersion = this.currentState.stateVersion;

    if (currentStateVersion !== STATE_VERSION) {
      if (currentStateVersion === 0.0) {
        // Migrating from <= 2.0.4
        await browser.storage.local.clear();
        const migratedState = { ...this.initialState };

        // TODO: Add migration

        await browser.storage.local.set(migratedState);
      }
    }

    // TODO: Should we do this? If we have large amounts of stored data this would be expensive
    //await browser.storage.local.set(this.currentState);
  }

  public dump() {
    console.debug(this.currentState);
  }
}
