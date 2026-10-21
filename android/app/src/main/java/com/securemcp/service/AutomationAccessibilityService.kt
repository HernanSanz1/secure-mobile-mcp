package com.securemcp.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Intent
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

class AutomationAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "AutomationA11y"

        @Volatile
        var instance: AutomationAccessibilityService? = null
            private set

        fun isEnabled(): Boolean = instance != null
    }

    private val json = Json { ignoreUnknownKeys = true }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.i(TAG, "Accessibility service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Events can be monitored here if needed for automation
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility service interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
        Log.i(TAG, "Accessibility service destroyed")
    }

    fun executeAction(actionPayload: String) {
        val action = json.decodeFromString<UiAction>(actionPayload)
        when (action.type) {
            "tap" -> performTap(action.x ?: 0f, action.y ?: 0f)
            "swipe" -> performSwipe(
                action.startX ?: 0f, action.startY ?: 0f,
                action.endX ?: 0f, action.endY ?: 0f,
                action.duration ?: 300L
            )
            "click_text" -> clickByText(action.text ?: "")
            "click_id" -> clickById(action.resourceId ?: "")
            "input_text" -> inputText(action.text ?: "")
            "scroll" -> performScroll(action.direction ?: "down")
            "back" -> performGlobalAction(GLOBAL_ACTION_BACK)
            "home" -> performGlobalAction(GLOBAL_ACTION_HOME)
            "recents" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
            "notifications" -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
            "screenshot" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT)
                }
            }
            else -> Log.w(TAG, "Unknown action type: ${action.type}")
        }
    }

    private fun performTap(x: Float, y: Float) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return

        val path = Path().apply { moveTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 100))
            .build()

        dispatchGesture(gesture, null, null)
    }

    private fun performSwipe(startX: Float, startY: Float, endX: Float, endY: Float, duration: Long) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return

        val path = Path().apply {
            moveTo(startX, startY)
            lineTo(endX, endY)
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, duration))
            .build()

        dispatchGesture(gesture, null, null)
    }

    private fun clickByText(text: String) {
        val rootNode = rootInActiveWindow ?: return
        val nodes = rootNode.findAccessibilityNodeInfosByText(text)
        nodes.firstOrNull()?.let { node ->
            if (node.isClickable) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            } else {
                // Try to click parent
                node.parent?.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            }
        }
        rootNode.recycle()
    }

    private fun clickById(resourceId: String) {
        val rootNode = rootInActiveWindow ?: return
        val nodes = rootNode.findAccessibilityNodeInfosByViewId(resourceId)
        nodes.firstOrNull()?.let { node ->
            if (node.isClickable) {
                node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            } else {
                node.parent?.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            }
        }
        rootNode.recycle()
    }

    private fun inputText(text: String) {
        val rootNode = rootInActiveWindow ?: return
        val focusedNode = rootNode.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        focusedNode?.let { node ->
            val arguments = Bundle().apply {
                putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
            }
            node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
        }
        rootNode.recycle()
    }

    private fun performScroll(direction: String) {
        val rootNode = rootInActiveWindow ?: return

        fun findScrollable(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
            node ?: return null
            if (node.isScrollable) return node
            for (i in 0 until node.childCount) {
                val result = findScrollable(node.getChild(i))
                if (result != null) return result
            }
            return null
        }

        findScrollable(rootNode)?.let { scrollableNode ->
            val action = when (direction.lowercase()) {
                "up" -> AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
                "down" -> AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
                "left" -> AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
                "right" -> AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
                else -> AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
            }
            scrollableNode.performAction(action)
        }
        rootNode.recycle()
    }

    fun getScreenContent(): String {
        val rootNode = rootInActiveWindow ?: return "[]"
        val elements = mutableListOf<ScreenElement>()
        traverseNode(rootNode, elements)
        rootNode.recycle()
        return json.encodeToString(ScreenElement.serializer(), elements.first())
    }

    private fun traverseNode(node: AccessibilityNodeInfo?, elements: MutableList<ScreenElement>) {
        node ?: return

        val bounds = Rect()
        node.getBoundsInScreen(bounds)

        val element = ScreenElement(
            className = node.className?.toString() ?: "",
            text = node.text?.toString(),
            contentDescription = node.contentDescription?.toString(),
            resourceId = node.viewIdResourceName,
            isClickable = node.isClickable,
            isScrollable = node.isScrollable,
            bounds = ElementBounds(bounds.left, bounds.top, bounds.right, bounds.bottom)
        )
        elements.add(element)

        for (i in 0 until node.childCount) {
            traverseNode(node.getChild(i), elements)
        }
    }

    @Serializable
    data class UiAction(
        val type: String,
        val x: Float? = null,
        val y: Float? = null,
        val startX: Float? = null,
        val startY: Float? = null,
        val endX: Float? = null,
        val endY: Float? = null,
        val duration: Long? = null,
        val text: String? = null,
        val resourceId: String? = null,
        val direction: String? = null
    )

    @Serializable
    data class ScreenElement(
        val className: String,
        val text: String? = null,
        val contentDescription: String? = null,
        val resourceId: String? = null,
        val isClickable: Boolean = false,
        val isScrollable: Boolean = false,
        val bounds: ElementBounds? = null
    )

    @Serializable
    data class ElementBounds(
        val left: Int,
        val top: Int,
        val right: Int,
        val bottom: Int
    )
}
