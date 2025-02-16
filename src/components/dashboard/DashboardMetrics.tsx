import type React from "react"
import { Bar, Doughnut } from "react-chartjs-2"
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js"
import { motion } from "framer-motion"
import { utils } from "@/styles/utils"
import { colors } from "@/styles/colors"

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const DashboardMetrics: React.FC = () => {
  const callData = {
    labels: ["Total Calls", "Successful Connections", "Avg. Duration (min)"],
    datasets: [
      {
        data: [50, 35, 20],
        backgroundColor: [colors.primary, colors.secondary, colors.accent],
        borderColor: [colors.primary, colors.secondary, colors.accent],
        borderWidth: 1,
      },
    ],
  }

  const ratingData = {
    labels: ["5 Stars", "4 Stars", "3 Stars", "2 Stars", "1 Star"],
    datasets: [
      {
        data: [20, 15, 10, 3, 2],
        backgroundColor: [colors.status.success, colors.primary, colors.secondary, colors.accent, colors.status.error],
        borderColor: colors.text.primary,
        borderWidth: 1,
      },
    ],
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h3 className="text-xl font-semibold mb-4">Call Statistics</h3>
        <Bar
          data={callData}
          options={{
            responsive: true,
            plugins: {
              legend: {
                display: false,
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  color: colors.text.secondary,
                },
              },
              x: {
                ticks: {
                  color: colors.text.secondary,
                },
              },
            },
          }}
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h3 className="text-xl font-semibold mb-4">Rating Distribution</h3>
        <Doughnut
          data={ratingData}
          options={{
            responsive: true,
            plugins: {
              legend: {
                position: "right" as const,
                labels: {
                  color: colors.text.secondary,
                },
              },
            },
          }}
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="md:col-span-2"
      >
        <div className={`${utils.cardBg} rounded-lg p-4 flex justify-between items-center`}>
          <div>
            <h3 className="text-lg font-semibold">Trust Score</h3>
            <p className="text-3xl font-bold text-green-400">92%</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Total Connections</h3>
            <p className="text-3xl font-bold text-blue-400">127</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Avg. Call Rating</h3>
            <p className="text-3xl font-bold text-yellow-400">4.7</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default DashboardMetrics

