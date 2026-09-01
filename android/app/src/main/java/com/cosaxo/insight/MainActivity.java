package com.cosaxo.insight;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /**
     * App-local plugins must be registered BEFORE super.onCreate, which is
     * where the bridge is built — registering after it leaves the plugin
     * compiled, shipped and invisible to JS. That failure is silent
     * (isPluginAvailable simply answers false and activation defers), which
     * is the same shape as the missing bridge D342 found, so
     * `npm run check:devicebind` asserts this call exists.
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceBindPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
