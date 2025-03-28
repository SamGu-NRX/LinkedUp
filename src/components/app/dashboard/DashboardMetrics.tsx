import type React from "react"
import { Bar, Doughnut } from "react-chartjs-2"
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js"
import { motion } from "framer-motion"

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const DashboardMetrics: React.FC = () => {
  // Chart configurations with more minimal design
  const callData = {
    labels: ["Total Calls", "Connections", "Avg. Duration"],
    datasets: [
      {
        data: [50, 35, 20],
        backgroundColor: ["rgba(99, 102, 241, 0.8)", "rgba(16, 185, 129, 0.8)", "rgba(250, 204, 21, 0.8)"],
        borderWidth: 0,
        borderRadius: 4,
      },
    ],
  }
  
  const ratingData = {
    labels: ["5★", "4★", "3★", "2★", "1★"],
    datasets: [
      {
        data: [20, 15, 10, 3, 2],
        backgroundColor: [
          "rgba(16, 185, 129, 0.8)",
          "rgba(99, 102, 241, 0.8)",
          "rgba(250, 204, 21, 0.8)",
          "rgba(251, 146, 60, 0.8)",
          "rgba(239, 68, 68, 0.8)"
        ],
        borderWidth: 0,
        cutout: '70%'
      },
    ],
  }
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 10,
        cornerRadius: 4,
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 12
          }
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 12
          }
        }
      },
    },
  }
  
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          boxWidth: 10,
          padding: 15,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 10,
        cornerRadius: 4,
      }
    },
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-xs"
        >
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Trust Score</div>
          <div className="text-2xl font-medium mt-1 text-emerald-500">92%</div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-xs"
        >
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Total Connections</div>
          <div className="text-2xl font-medium mt-1 text-indigo-500">127</div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-xs"
        >
          <div className="text-sm text-zinc-500 dark:text-zinc-400">Avg. Rating</div>
          <div className="text-2xl font-medium mt-1 text-amber-500">4.7★</div>
        </motion.div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-xs"
        >
          <h3 className="text-sm font-medium mb-4 text-zinc-500 dark:text-zinc-400">Call Statistics</h3>
          <div className="h-64">
            <Bar data={callData} options={chartOptions} />
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-xs"
        >
          <h3 className="text-sm font-medium mb-4 text-zinc-500 dark:text-zinc-400">Rating Distribution</h3>
          <div className="h-64">
            <Doughnut data={ratingData} options={doughnutOptions} />
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default DashboardMetrics