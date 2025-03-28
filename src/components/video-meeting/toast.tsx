"use client"

import { motion, AnimatePresence } from "framer-motion"
import { createElement, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import type { LucideIcon } from "lucide-react"

interface Toast {
  id: string
  message: string
  icon?: LucideIcon
  type?: "info" | "success" | "error"
  duration?: number
}

interface ToastProps {
  toast: Toast
  onRemove: (id: string) => void
}

const ToastComponent = ({ toast, onRemove }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id)
    }, toast.duration || 4000)

    return () => clearTimeout(timer)
  }, [toast, onRemove])

  const bgColor = {
    info: "bg-zinc-800",
    success: "bg-emerald-500",
    error: "bg-red-500",
  }[toast.type || "info"]

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ type: "tween", duration: 0.2 }}
      className={`flex items-center space-x-2 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg`}
    >
      {toast.icon && createElement(toast.icon, { className: "w-4 h-4" })}
      <span className="text-sm">{toast.message}</span>
    </motion.div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  // Expose the add toast function globally
  useEffect(() => {
    const addToast = (toast: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { ...toast, id }])
    }

    window.addToast = addToast
    return () => {
      // delete window.addToast
      window.addToast = () => {};
      /*
        delete cannot be used with non-optional parameters
        therfore, I have made addToast a "dummy" function as per ChatGPT
        the prior code is commented
      */
    }
  }, [])

  if (typeof document === "undefined") return null

  return createPortal(
    <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastComponent key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

declare global {
  interface Window {
    addToast: (toast: Omit<Toast, "id">) => void
  }
}

