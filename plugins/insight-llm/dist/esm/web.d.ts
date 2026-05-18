import { WebPlugin } from "@capacitor/core";
import type { DownloadModelOptions, DownloadModelResult, GenerateOptions, GenerateResult, InsightLLMPlugin, ReadinessState, SetModelOptions } from "./definitions";
export declare class InsightLLMWeb extends WebPlugin implements InsightLLMPlugin {
    setModel(_options: SetModelOptions): Promise<void>;
    downloadModel(_options: DownloadModelOptions): Promise<DownloadModelResult>;
    generate(_options: GenerateOptions): Promise<GenerateResult>;
    getReadiness(): Promise<{
        readiness: ReadinessState;
    }>;
    getPluginVersion(): Promise<{
        version: string;
    }>;
}
