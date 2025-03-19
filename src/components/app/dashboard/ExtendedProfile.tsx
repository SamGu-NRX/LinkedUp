import type React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import { Award, Briefcase, Globe, Link } from "lucide-react"
import { Switch } from "@/components/ui/switch"

const ExtendedProfile: React.FC = () => {
  const [showPersonalDetails, setShowPersonalDetails] = useState(true)

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-xs"
        >
          <h3 className="text-sm font-medium mb-4 text-zinc-500 dark:text-zinc-400">Badges</h3>
          <div className="flex flex-wrap gap-2">
            <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-xs flex items-center">
              <Award size={14} className="mr-1.5" /> Top Connector
            </span>
            <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full text-xs flex items-center">
              <Briefcase size={14} className="mr-1.5" /> Industry Expert
            </span>
            <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full text-xs flex items-center">
              <Globe size={14} className="mr-1.5" /> Global Networker
            </span>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-xs"
        >
          <h3 className="text-sm font-medium mb-4 text-zinc-500 dark:text-zinc-400">Skills</h3>
          <div className="flex flex-wrap gap-2">
            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1 rounded-full text-xs">JavaScript</span>
            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1 rounded-full text-xs">React</span>
            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1 rounded-full text-xs">Node.js</span>
            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1 rounded-full text-xs">UX Design</span>
            <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1 rounded-full text-xs">Project Management</span>
          </div>
        </motion.div>
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-xs"
      >
        <h3 className="text-sm font-medium mb-4 text-zinc-500 dark:text-zinc-400">Privacy</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm">Show personal details to matches</span>
          <Switch
            checked={showPersonalDetails}
            onCheckedChange={setShowPersonalDetails}
          />
        </div>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-xs"
      >
        <h3 className="text-sm font-medium mb-4 text-zinc-500 dark:text-zinc-400">External Links</h3>
        <div className="space-y-3">
          <div className="flex items-center">
            <Link size={16} className="text-zinc-400 mr-3" />
            <input 
              type="text" 
              placeholder="Personal Website" 
              className="w-full bg-transparent border-b border-zinc-200 dark:border-zinc-700 pb-1 text-sm focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center">
            <Link size={16} className="text-zinc-400 mr-3" />
            <input 
              type="text" 
              placeholder="LinkedIn Profile" 
              className="w-full bg-transparent border-b border-zinc-200 dark:border-zinc-700 pb-1 text-sm focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center">
            <Link size={16} className="text-zinc-400 mr-3" />
            <input 
              type="text" 
              placeholder="GitHub Profile" 
              className="w-full bg-transparent border-b border-zinc-200 dark:border-zinc-700 pb-1 text-sm focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default ExtendedProfile