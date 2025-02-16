import type React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import { Award, Briefcase, Globe, Link } from "lucide-react"
import { utils } from "@/styles/utils"

const ExtendedProfile: React.FC = () => {
  const [showPersonalDetails, setShowPersonalDetails] = useState(true)

  const togglePersonalDetails = () => {
    setShowPersonalDetails(!showPersonalDetails)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h3 className="text-xl font-semibold mb-4">Accolades & Badges</h3>
        <div className="flex flex-wrap gap-2">
          <span className={`${utils.buttonPrimary} px-3 py-1 rounded-full text-sm flex items-center`}>
            <Award size={16} className="mr-1" /> Top Connector
          </span>
          <span className={`${utils.buttonSecondary} px-3 py-1 rounded-full text-sm flex items-center`}>
            <Briefcase size={16} className="mr-1" /> Industry Expert
          </span>
          <span className={`${utils.buttonAccent} px-3 py-1 rounded-full text-sm flex items-center`}>
            <Globe size={16} className="mr-1" /> Global Networker
          </span>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h3 className="text-xl font-semibold mb-4">Skills & Expertise</h3>
        <div className="flex flex-wrap gap-2">
          <span className={`${utils.cardBg} px-3 py-1 rounded-full text-sm`}>JavaScript</span>
          <span className={`${utils.cardBg} px-3 py-1 rounded-full text-sm`}>React</span>
          <span className={`${utils.cardBg} px-3 py-1 rounded-full text-sm`}>Node.js</span>
          <span className={`${utils.cardBg} px-3 py-1 rounded-full text-sm`}>UX Design</span>
          <span className={`${utils.cardBg} px-3 py-1 rounded-full text-sm`}>Project Management</span>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="md:col-span-2"
      >
        <h3 className="text-xl font-semibold mb-4">Privacy Settings</h3>
        <div className="flex items-center justify-between mb-4">
          <span>Show Personal Details to Matches</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={showPersonalDetails}
              onChange={togglePersonalDetails}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="md:col-span-2"
      >
        <h3 className="text-xl font-semibold mb-4">External Links</h3>
        <div className="space-y-2">
          <div className="flex items-center">
            <Link size={20} className="mr-2" />
            <input type="text" placeholder="Personal Website" className={`${utils.cardBg} rounded px-3 py-2 w-full`} />
          </div>
          <div className="flex items-center">
            <Link size={20} className="mr-2" />
            <input type="text" placeholder="LinkedIn Profile" className={`${utils.cardBg} rounded px-3 py-2 w-full`} />
          </div>
          <div className="flex items-center">
            <Link size={20} className="mr-2" />
            <input type="text" placeholder="GitHub Profile" className={`${utils.cardBg} rounded px-3 py-2 w-full`} />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default ExtendedProfile

