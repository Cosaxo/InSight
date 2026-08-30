package com.cosaxo.insight;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.integrity.IntegrityManager;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.IntegrityTokenRequest;
import java.security.SecureRandom;

/**
 * The Android half of D29's device binding — Play Integrity, whose verdict
 * carries the Device Recall bits that bound one counted account per device
 * per calendar month (docs/DEVICE-BIND.md).
 *
 * <p>THE NONCE IS NOT OPTIONAL, and the version of this file that sat in
 * DEVICE-BIND.md as "paste-ready" omitted it. {@code IntegrityTokenRequest}
 * refuses to build without one, so that snippet would have failed on every
 * device it ever ran on — silently, from the app's point of view, because
 * {@code src/v2/data/deviceBind.ts} treats any activation failure as "try
 * again on a later boot". Pasting it would have looked exactly like the
 * missing-bridge state it was meant to end (D337).
 *
 * <p>WHAT THE NONCE BUYS HERE, stated honestly because it is less than the
 * word usually implies. Play echoes it back inside the signed payload, so
 * the server can refuse a token minted for a different request — that stops
 * a captured token being replayed against this callable. It does NOT stop
 * the caller replaying its own, because the caller chooses it. The stronger
 * shape is a server-issued nonce, which costs a second round trip before
 * every activation; it is not built because the recall write is what
 * actually bounds the device, and that write is server-side and idempotent
 * per month. If activation ever becomes worth attacking directly, this is
 * the seam to move.
 */
@CapacitorPlugin(name = "DeviceBind")
public class DeviceBindPlugin extends Plugin {

    @PluginMethod
    public void requestIntegrityToken(PluginCall call) {
        final String nonce = freshNonce();
        IntegrityTokenRequest.Builder req = IntegrityTokenRequest.builder().setNonce(nonce);
        // Required only for apps not distributed by Play. Passed from JS
        // rather than compiled in so a non-Play build can supply it without
        // a native change; absent is the normal case.
        String cloudProjectNumber = call.getString("cloudProjectNumber");
        if (cloudProjectNumber != null) {
            try {
                req.setCloudProjectNumber(Long.parseLong(cloudProjectNumber));
            } catch (NumberFormatException e) {
                call.reject("bad cloudProjectNumber");
                return;
            }
        }
        IntegrityManager manager = IntegrityManagerFactory.create(getContext());
        manager
            .requestIntegrityToken(req.build())
            .addOnSuccessListener(r -> {
                JSObject out = new JSObject();
                out.put("token", r.token());
                // The server compares this against requestDetails.nonce in
                // the decoded payload. Returning it is what makes that
                // comparison possible at all.
                out.put("nonce", nonce);
                call.resolve(out);
            })
            .addOnFailureListener(e -> call.reject("integrity token failed: " + e.getMessage()));
    }

    @PluginMethod
    public void generateToken(PluginCall call) {
        // DeviceCheck's half. Declared so one TypeScript interface covers
        // both platforms and the JS branches on the platform, never on
        // whether a method happens to exist.
        call.reject("ios only");
    }

    /**
     * 32 random bytes, base64url, unpadded — Play requires URL-safe base64
     * decoding to between 16 and 500 bytes, and rejects wrapped input.
     */
    private static String freshNonce() {
        byte[] raw = new byte[32];
        new SecureRandom().nextBytes(raw);
        return Base64.encodeToString(raw, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }
}
